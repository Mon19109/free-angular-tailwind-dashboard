import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environments';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('RegistroProspectoCliente: consulta de liquidación', () => {
  let component: RegistroProspectoClienteComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: {} }]
    });
    component = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    component.cuentaComercio = { commerceGuid: 'commerce-del-get' };
    component.link = 'link-prospecto';
    component.arbol = [{ id: 'inicial', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUC000', levelType: 5 }];
    component.nodoSeleccionado = 'inicial';
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  for (const status of [200, 400]) {
    it(`muestra el mensaje del prospecto y oculta SMS cuando el enlace falla con HTTP ${status}`, () => {
      component['cargarProspecto']();
      const request = http.expectOne(req => req.url === `${environment.api.KashpayCoreAPI}prospect`);
      const message = 'Enlace ya fue completado, verifique o reporte al Administrador.';
      request.flush({ success: false, error: { name: '', message, code: '4005' } }, { status, statusText: status === 200 ? 'OK' : 'Bad Request' });
      expect(component.errorProspecto).toBe(message);
      expect(component.showTokenModal).toBeFalse();
      expect(component.cargando).toBeFalse();
      expect(component.prospecto).toBeNull();
      component.tokenValue = '123456';
      component.validarTokenSms();
      component.continuarLiquidacion();
      component.finalizar();
      http.expectNone(() => true);
    });
  }

  it('bloquea los envíos mientras hay un guardado en curso', () => {
    component.guardandoLiquidacion = true;
    component.finalizar();
    component.continuarLiquidacion();
    component.modalLiquidacion = 'en-red';
    component.aceptarModalLiquidacion();
    component.guardandoLiquidacion = false;
    component.guardando = true;
    component.continuarLiquidacion();
    component.finalizar();
    http.expectNone(() => true);
  });

  async function adjuntar(tipo: 'carta' | 'edc', archivo = new File(['%PDF-1.7 contenido'], `${tipo}.pdf`, { type: 'application/pdf' })) {
    await component['asignarArchivoLiquidacion'](archivo, tipo);
  }

  function actualizarDispersion(valor: string) {
    const request = http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ commerceGuid: 'commerce-del-get', dispersionAccount: valor });
    expect(request.request.headers.get('versionApp')).toBe('3');
    expect(request.request.headers.get('Authorization')).toContain('Bearer eyJhbGciOiJIUzUxMiJ9.');
    return request;
  }

  function completarSeguimiento() {
    const request = http.expectOne(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ url: 'link-prospecto', statusDescription: 'COMPLETED' });
    expect(request.request.headers.has('Authorization')).toBeFalse();
    return request;
  }

  function prepararLiquidacionPendiente() {
    component.cuentaComercio = { commerceGuid: 'commerce-del-get', dispersionAccount: 'CONC_ADQUI' };
    component['validarLiquidacionDesdeCuenta']();
  }

  for (const [dispersion, opcion] of [
    ['NETWORK', 'en-red'], ['OTHER_BANK', 'otros-bancos'], ['OTHER_BANK_AND_NETWORK', 'otros-bancos-en-red']
  ]) {
    it(`marca ${dispersion} como concluida desde account/get sin consultar cuentas CL`, () => {
      component.prospectId = 'SUB0048790';
      spyOn<any>(component, 'cargarFormulariosDesdeGet');
      spyOn<any>(component, 'consultarArbolReal');
      component.consultarCuentaComercio();
      const request = http.expectOne(req => req.url === `${environment.api.kashpay}api/v1/account/get`);
      expect(request.request.params.get('sirioId')).toBe('SUB0048790');
      expect(component.liquidacionConsultada).toBeFalse();
      request.flush({ success: true, entityInfo: { commerceGuid: 'commerce-del-get', dispersionAccount: dispersion } });
      expect(component.liquidacionCompleta).toBeTrue();
      expect(component.pasoActivo).toBe('accesos');
      expect(component.liquidacionForm.controls.cuentaFueraRed.value).toBe(opcion);
      expect(component.modalLiquidacion).toBeNull();
      component.volverLiquidacion();
      expect(component.pasoActivo).toBe('accesos');
      http.expectNone(() => true);
    });
  }

  for (const dispersion of ['CONC_ADQUI', '', undefined, 'DESCONOCIDO']) {
    it(`mantiene pendiente y editable la liquidación con ${dispersion}`, () => {
      component.cuentaComercio = { dispersionAccount: dispersion };
      component.liquidacionRegistrada = true;
      component['validarLiquidacionDesdeCuenta']();
      expect(component.liquidacionConsultada).toBeTrue();
      expect(component.liquidacionCompleta).toBeFalse();
      expect(component.pasoActivo).toBe('liquidacion');
      expect(component.liquidacionForm.controls.nombreBeneficiario.enabled).toBeTrue();
      component.continuarLiquidacion();
      expect(component.error).not.toBe('');
      http.expectNone(() => true);
    });
  }

  for (const status of [200, 500]) {
    it(`permite reintentar account/get fallido con HTTP ${status} sin completar la liquidación`, () => {
      component.prospectId = 'SUB0048790';
      spyOn<any>(component, 'cargarFormulariosDesdeGet');
      spyOn<any>(component, 'consultarArbolReal');
      component.consultarCuentaComercio();
      http.expectOne(req => req.url.endsWith('account/get')).flush({ success: false }, { status, statusText: status === 200 ? 'OK' : 'Error' });
      expect(component.liquidacionConsultada).toBeFalse();
      expect(component.cargandoCuenta).toBeFalse();
      expect(component.errorLiquidacion).not.toBe('');
      component.consultarCuentaComercio();
      http.expectOne(req => req.url.endsWith('account/get')).flush({ dispersionAccount: 'NETWORK' });
      expect(component.liquidacionCompleta).toBeTrue();
      expect(component.errorLiquidacion).toBe('');
      http.expectNone(() => true);
    });
  }

  it('completa En Red al aceptar sin registrar una cuenta bancaria', () => {
    prepararLiquidacionPendiente();
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.continuarLiquidacion();
    expect(component.modalLiquidacion).toBe('en-red');
    expect(component.liquidacionCompleta).toBeFalse();
    component.aceptarModalLiquidacion();
    expect(component.liquidacionCompleta).toBeFalse();
    component.aceptarModalLiquidacion();
    actualizarDispersion('NETWORK').flush({ success: true });
    expect(component.liquidacionCompleta).toBeTrue();
    expect(component.pasoActivo).toBe('accesos');
    http.expectNone(request => request.method === 'POST');
  });

  it('permite reintentar En Red si falla el PUT sin completar ni enviar contact', () => {
    prepararLiquidacionPendiente();
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.continuarLiquidacion();
    component.aceptarModalLiquidacion();
    actualizarDispersion('NETWORK').flush({ success: false });
    expect(component.liquidacionCompleta).toBeFalse();
    expect(component.modalLiquidacion).toBe('en-red');
    expect(component.guardandoLiquidacion).toBeFalse();
    expect(component.error).not.toBe('');
    component.aceptarModalLiquidacion();
    actualizarDispersion('NETWORK').flush({}, { status: 500, statusText: 'Error' });
    expect(component.liquidacionCompleta).toBeFalse();
    component.aceptarModalLiquidacion();
    actualizarDispersion('NETWORK').flush(null);
    expect(component.liquidacionCompleta).toBeTrue();
    http.expectNone(request => request.method === 'POST');
  });

  it('bloquea En Red cuando falta commerceGuid del resumen', () => {
    prepararLiquidacionPendiente();
    component.cuentaComercio = {};
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.continuarLiquidacion();
    component.aceptarModalLiquidacion();
    expect(component.error).toContain('identificador');
    expect(component.liquidacionCompleta).toBeFalse();
    http.expectNone(request => request.method === 'PUT');
  });

  for (const tipo of ['fisica', 'moral'] as const) {
    it(`registra ${tipo} con su catálogo y no completa antes del éxito`, async () => {
      prepararLiquidacionPendiente();
      component.cuentaComercio = { commerceGuid: 'commerce-del-get', idSirio: 'NO-USAR-CUENTA' };
      component.arbol = [
        { id: 'raiz', nombre: 'Entidad', nivel: 'entidad', idSirio: 'NO-USAR-RAIZ' },
        { id: 'seleccionado', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUB0048790' }
      ];
      component.nodoSeleccionado = 'seleccionado';
      await adjuntar('carta');
      await adjuntar('edc');
      component.liquidacionForm.patchValue({
        cuentaFueraRed: tipo === 'moral' ? 'otros-bancos-en-red' : 'otros-bancos',
        tipoPersonaBeneficiario: tipo,
        nombreBeneficiario: 'Ana', apellidoPaternoBeneficiario: 'Perez', apellidoMaternoBeneficiario: 'Lopez',
        correoBeneficiario: 'ana@example.com', direccionBeneficiario: 'Calle 1', rfcBeneficiario: 'AAAA010101AAA',
        actividadBeneficiario: 'Actividad', idActivity: 12, giroBeneficiario: 'WYNN LAS VEGAS', giro: 780,
        tipoCuenta: 'CLABE', cuentaClabe: '646180289216322143', nombreBanco: 'STP', idInstitution: 90646,
        accountNumber: '0', direccionBanco: 'Calle 2', telefonoBanco: '5512345678', emailBanco: 'banco@example.com'
      });
      component.continuarLiquidacion();
      actualizarDispersion(tipo === 'moral' ? 'OTHER_BANK_AND_NETWORK' : 'OTHER_BANK').flush({ success: true });
      http.expectNone(`${environment.api.documents}createDirectory`);
      const upload = http.expectOne(`${environment.api.documents}uploadFiles`);
      expect(upload.request.body.get('folderName')).toBe('commerce-del-get');
      expect(upload.request.body.getAll('files').length).toBe(2);
      upload.flush({ success: true });
      const request = http.expectOne(`${environment.api.KashpayCoreAPI}contact`);
      const body = request.request.body;
      expect(body.identifier).toBe('SUB0048790');
      expect(body.idUser).toBeUndefined();
      expect(body.accountNumber).toBe('0');
      expect(body.typeRegister).toBe('CL');
      expect(body.typeTransfer).toBe(1);
      expect(body.beneficiaryType).toBe(tipo === 'moral' ? 'PM' : 'PF');
      expect(body.aditionalData.currency).toBe('484');
      expect(body.aditionalData[tipo === 'moral' ? 'businessLine' : 'businessActivity']).toBe(tipo === 'moral' ? '780|WYNN LAS VEGAS' : '12|Actividad');
      expect(body.aditionalData[tipo === 'moral' ? 'businessActivity' : 'businessLine']).toBeUndefined();
      expect(component.liquidacionCompleta).toBeFalse();
      expect(component.modalLiquidacion).toBeNull();
      component.continuarLiquidacion();
      http.expectNone(`${environment.api.KashpayCoreAPI}contact`);
      request.flush({ success: false, message: 'Error al registrar' });
      expect(component.modalLiquidacion).toBeNull();
      expect(component.liquidacionCompleta).toBeFalse();
      component.continuarLiquidacion();
      actualizarDispersion(tipo === 'moral' ? 'OTHER_BANK_AND_NETWORK' : 'OTHER_BANK').flush({ success: true });
      http.expectNone(`${environment.api.documents}uploadFiles`);
      http.expectOne(`${environment.api.KashpayCoreAPI}contact`).flush({ success: true });
      expect(component.liquidacionCompleta).toBeTrue();
      expect(component.modalLiquidacion).toBe('guardada');
    });
  }

  it('rechaza imágenes y archivos que solo tengan extensión PDF', async () => {
    await adjuntar('carta', new File(['imagen'], 'imagen.png', { type: 'image/png' }));
    expect(component.cartaLiquidacionArchivoNombre).toBe('');
    await adjuntar('edc', new File(['imagen'], 'falso.pdf', { type: 'application/pdf' }));
    expect(component.caratulaEdcArchivoNombre).toBe('');
    expect(component.error).toContain('PDF');
  });

  function prepararAccesos(modo: string) {
    component.arbol = [
      { id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUC001', levelType: 5 },
      { id: 'entidad', nombre: 'Entidad', nivel: 'entidad', idSirio: 'ENT002', levelType: 4 },
      { id: 'caja', nombre: 'Caja', nivel: 'caja', idSirio: 'CAJ003', levelType: 6 }
    ];
    component.nodoSeleccionado = 'sucursal';
    component.liquidacionConsultada = true;
    component.liquidacionRegistrada = true;
    component.liquidacionForm.controls.cuentaFueraRed.setValue(modo);
    component['actualizarValidadoresAccesos']();
  }

  for (const [typeOfBusiness, prefijo, titulo] of [
    [5, 'controlador', 'Usuario Controlador de Recursos'],
    [17, 'supervisor', 'Usuario Supervisor de Terminales']
  ] as const) {
    for (const dispersionAccount of ['NETWORK', 'OTHER_BANK', 'OTHER_BANK_AND_NETWORK']) {
      it(`usa el perfil ${typeOfBusiness} del GET con ${dispersionAccount} para entidad`, () => {
        prepararAccesos('otros-bancos');
        component.seleccionarNodo('entidad');
        http.expectOne(req => req.url.endsWith('account/get')).flush({
          entityInfo: { idSirio: 'ENT002', typeOfBusiness: String(typeOfBusiness), dispersionAccount }
        });
        expect(component.usuariosAcceso.map(usuario => usuario.titulo)).toEqual([titulo]);
        expect(component.usuarioActivo).toBe(prefijo);
        component.finalizar();
        http.expectNone(`${environment.api.antaresAuth}user/add`);
        llenar(prefijo);
        component.finalizar();
        const request = http.expectOne(`${environment.api.antaresAuth}user/add`);
        expect(request.request.body).toEqual({
          sirioId: 'ENT002', idAffiliationLevel: 4, idProfile: typeOfBusiness,
          name: 'Ana', paternalSurname: 'Perez', maternalSurname: 'Lopez',
          email: `${prefijo}@example.com`, phoneNumber: '5512345678'
        });
        request.flush({ success: true });
        expect(component.accesosCompletos).toBeTrue();
        http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
        component.seleccionarNodo('sucursal');
        expect(component.usuariosAcceso[0].prefijo).toBe('admin');
        component.seleccionarNodo('entidad');
        expect(component.usuariosAcceso[0].prefijo).toBe(prefijo);
        expect(component.accesosCompletos).toBeTrue();
      });
    }
  }

  function consultarNodo(sirioId: string, dispersionAccount = 'OTHER_BANK') {
    const request = http.expectOne(req => req.url.endsWith('account/get'));
    expect(request.request.params.get('sirioId')).toBe(sirioId);
    request.flush({ success: true, entityInfo: { idSirio: sirioId, dispersionAccount } });
  }

  it('conserva liquidación, archivos y accesos por nodo sin concluir la sucursal al llenar entidad', async () => {
    prepararAccesos('otros-bancos');
    component.nodoSeleccionado = '';
    component.seleccionarNodo('entidad');
    consultarNodo('ENT002', '');
    component.liquidacionForm.controls.nombreBeneficiario.setValue('Entidad beneficiaria');
    await adjuntar('carta');
    component.liquidacionRegistrada = true;
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
    component.seleccionarNodo('sucursal');
    expect(component.liquidacionCompleta).toBeFalse();
    consultarNodo('SUC001', '');
    expect(component.liquidacionCompleta).toBeFalse();
    expect(component.accesosCompletos).toBeFalse();
    expect(component.nodoRegistroCompleto('entidad')).toBeTrue();
    expect(component.nodoRegistroCompleto('sucursal')).toBeFalse();
    expect(component.liquidacionForm.controls.nombreBeneficiario.value).toBe('');
    expect(component.cartaLiquidacionArchivoNombre).toBe('');
    expect(component.accesosForm.controls.adminNombre.value).toBe('');
    component.seleccionarNodo('entidad');
    expect(component.liquidacionCompleta).toBeTrue();
    expect(component.accesosCompletos).toBeTrue();
    expect(component.liquidacionForm.controls.nombreBeneficiario.value).toBe('Entidad beneficiaria');
    expect(component.cartaLiquidacionArchivoNombre).toBe('carta.pdf');
    expect(component.nodoRegistroCompleto('entidad')).toBeTrue();
    expect(component.nodoRegistroCompleto('sucursal')).toBeFalse();
    expect(component.nodoRegistroCompleto('caja')).toBeFalse();
    expect(component.accesosForm.controls.adminNombre.value).toBe('Ana');
    http.expectNone(() => true);
  });

  it('al aceptar los accesos de entidad avanza a la sucursal pendiente y omite cajas', () => {
    prepararAccesos('otros-bancos');
    const sucursal = component.arbol[0];
    const entidad = component.arbol[1];
    entidad.hijos = [component.arbol[2], sucursal];
    component.arbol = [entidad];
    component.nodoSeleccionado = 'entidad';
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    const cerrar = spyOn(component, 'cerrarPagina');
    component.aceptarModalAccesos();
    expect(cerrar).not.toHaveBeenCalled();
    expect(component.modalAccesos).toBeNull();
    expect(component.nodoSeleccionado).toBe('sucursal');
    consultarNodo('SUC001', '');
    expect(component.pasoActivo).toBe('liquidacion');
    expect(component.liquidacionCompleta).toBeFalse();
    expect(component.nodoRegistroCompleto('entidad')).toBeTrue();
  });

  it('al aceptar el último nodo permanece en la página con el registro completo', () => {
    prepararAccesos('otros-bancos');
    component.arbol = [component.arbol[0], component.arbol[2]];
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    completarSeguimiento().flush({ success: true });
    const cerrar = spyOn(component, 'cerrarPagina');
    component.aceptarModalAccesos();
    expect(cerrar).not.toHaveBeenCalled();
    expect(component.modalAccesos).toBeNull();
    expect(component.nodoSeleccionado).toBe('sucursal');
    expect(component.accesosCompletos).toBeTrue();
    http.expectNone(() => true);
  });

  it('al aceptar liquidación abre accesos del mismo nodo sin cerrar la página', () => {
    prepararAccesos('otros-bancos');
    component.nodoSeleccionado = 'entidad';
    component.pasoActivo = 'liquidacion';
    component.modalLiquidacion = 'guardada';
    const cerrar = spyOn(component, 'cerrarPagina');
    component.aceptarModalLiquidacion();
    expect(component.nodoSeleccionado).toBe('entidad');
    expect(component.pasoActivo).toBe('accesos');
    expect(component.modalLiquidacion).toBeNull();
    expect(cerrar).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('actualiza la dispersión con el commerceGuid de la cuenta del nodo consultado', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('entidad');
    const consulta = http.expectOne(req => req.url.endsWith('account/get'));
    spyOn<any>(component, 'cargarFormulariosDesdeGet');
    consulta.flush({ entityInfo: { idSirio: 'ENT002', commerceGuid: 'guid-entidad', dispersionAccount: '' } });
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.continuarLiquidacion();
    component.aceptarModalLiquidacion();
    const registro = http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`);
    expect(registro.request.body).toEqual({ commerceGuid: 'guid-entidad', dispersionAccount: 'NETWORK' });
    registro.flush({ success: true });
    component.seleccionarNodo('sucursal');
    expect(component.cuentaComercio?.['commerceGuid']).toBe('commerce-del-get');
    http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
  });

  it('ignora respuestas de cuentas de un nodo que dejó de estar seleccionado', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('entidad');
    const entidad = http.expectOne(req => req.url.endsWith('account/get'));
    component.seleccionarNodo('sucursal');
    entidad.flush({ entityInfo: { idSirio: 'ENT002', dispersionAccount: 'NETWORK' } });
    expect(component.liquidacionForm.controls.cuentaFueraRed.value).toBe('otros-bancos');
    expect(component.nodoSeleccionado).toBe('sucursal');
  });

  function llenar(prefijo: string) {
    component.accesosForm.patchValue({
      [`${prefijo}Nombre`]: 'Ana', [`${prefijo}Paterno`]: 'Perez', [`${prefijo}Materno`]: 'Lopez',
      [`${prefijo}Correo`]: `${prefijo}@example.com`, [`${prefijo}ConfirmarCorreo`]: `${prefijo}@example.com`,
      [`${prefijo}Telefono`]: '5512345678'
    });
  }

  it('exige FAC y TKT y conserva el éxito parcial para reintentar solo TKT', () => {
    prepararAccesos('otros-bancos-en-red');
    llenar('fac');
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
    expect(component.usuarioActivo).toBe('tkt');
    llenar('tkt');
    component.finalizar();
    const fac = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(fac.request.body).toEqual({ sirioId: 'SUC001', idAffiliationLevel: 5, idProfile: 5, name: 'Ana', paternalSurname: 'Perez', maternalSurname: 'Lopez', email: 'fac@example.com', phoneNumber: '5512345678' });
    fac.flush({ success: true });
    const tkt = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(tkt.request.body.idProfile).toBe(7);
    tkt.flush({ success: false });
    expect(component.accesosCompletos).toBeFalse();
    expect(component.modalAccesos).toBeNull();
    component.finalizar();
    const reintento = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(reintento.request.body.idProfile).toBe(7);
    reintento.flush({ success: true });
    expect(component.accesosCompletos).toBeFalse();
    completarSeguimiento().flush({ success: true });
    expect(component.accesosCompletos).toBeTrue();
    expect(component.modalAccesos).toBe('Sucursal');
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
    component.seleccionarNodo('entidad');
    consultarNodo('ENT002');
    expect(component.accesosCompletos).toBeFalse();
    expect(component.accesosForm.controls.facNombre.value).toBe('');
    component.seleccionarNodo('sucursal');
    expect(component.accesosCompletos).toBeTrue();
  });

  for (const [modo, perfil] of [['otros-bancos', 7], ['en-red', 5]] as const) {
    it(`envía un administrador con perfil ${perfil} para el nodo seleccionado`, () => {
      prepararAccesos(modo);
      component.seleccionarNodo('entidad');
      consultarNodo('ENT002', modo === 'en-red' ? 'NETWORK' : 'OTHER_BANK');
      llenar('admin');
      component.finalizar();
      const request = http.expectOne(`${environment.api.antaresAuth}user/add`);
      expect(request.request.body.idProfile).toBe(perfil);
      expect(request.request.body.sirioId).toBe('ENT002');
      expect(request.request.body.idAffiliationLevel).toBe(4);
      request.flush({ success: true });
      http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
      expect(component.accesosCompletos).toBeTrue();
      expect(component.modalAccesos).toBe('Entidad');
    });
  }

  it('reintenta únicamente seguimiento si los accesos ya se enviaron', () => {
    prepararAccesos('otros-bancos');
    llenar('admin');
    component.finalizar();
    http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    component.finalizar();
    completarSeguimiento().flush({}, { status: 500, statusText: 'Error' });
    expect(component.accesosCompletos).toBeFalse();
    expect(component.guardando).toBeFalse();
    expect(component.modalAccesos).toBeNull();
    expect(component.error).toContain('completar el seguimiento');
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
    completarSeguimiento().flush({ success: false });
    expect(component.accesosCompletos).toBeFalse();
    component.finalizar();
    completarSeguimiento().flush(null);
    expect(component.accesosCompletos).toBeTrue();
    expect(component.modalAccesos).toBe('Sucursal');
    component.finalizar();
    http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
  });

  it('no envía información sin el enlace de seguimiento', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('entidad');
    consultarNodo('ENT002');
    llenar('admin');
    component.link = '';
    component.finalizar();
    expect(component.error).toContain('enlace de seguimiento');
    http.expectNone(request => request.method === 'POST' || request.method === 'PUT');
  });

  it('no envía accesos para cajas', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('caja');
    component.finalizar();
    component.continuarLiquidacion();
    component.modalLiquidacion = 'en-red';
    component.aceptarModalLiquidacion();
    http.expectNone(() => true);
  });

  it('requiere ambos documentos y bloquea el registro si falla la carga', async () => {
    prepararLiquidacionPendiente();
    component.cuentaComercio = { commerceGuid: 'commerce-del-get', idSirio: 'NO-USAR-CUENTA' };
      component.arbol = [
        { id: 'raiz', nombre: 'Entidad', nivel: 'entidad', idSirio: 'NO-USAR-RAIZ' },
        { id: 'seleccionado', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUB0048790' }
      ];
      component.nodoSeleccionado = 'seleccionado';
    component.liquidacionForm.patchValue({ idInstitution: 90646, idActivity: 12 });
    component.liquidacionForm.disable();
    component.continuarLiquidacion();
    expect(component.error).toContain('Adjunta');
    expect(component.errorArchivoLiquidacion('carta')).toContain('PDF');
    expect(component.errorArchivoLiquidacion('edc')).toContain('PDF');
    http.expectNone(request => request.method === 'POST');
    await adjuntar('carta');
    expect(component.errorArchivoLiquidacion('carta')).toBe('');
    expect(component.errorArchivoLiquidacion('edc')).toContain('PDF');
    component.continuarLiquidacion();
    expect(component.error).toContain('Adjunta');
    http.expectNone(request => request.method === 'POST');
    await adjuntar('edc');
    component.continuarLiquidacion();
    actualizarDispersion('OTHER_BANK').flush({ success: true });
    http.expectNone(`${environment.api.documents}createDirectory`);
    const upload = http.expectOne(`${environment.api.documents}uploadFiles`);
    expect(upload.request.headers.get('Authorization')).toBe(`Bearer ${component.prospectoBearerToken}`);
    upload.flush({ success: false });
    expect(component.error).toContain('aún no se ha enviado');
    http.expectNone(`${environment.api.KashpayCoreAPI}contact`);
    expect(component.liquidacionCompleta).toBeFalse();
    expect(component.guardandoLiquidacion).toBeFalse();
  });

  it('no envía un acceso sin los identificadores del árbol', () => {
    prepararAccesos('otros-bancos');
    component.arbol[0].idSirio = '';
    llenar('admin');
    component.finalizar();
    expect(component.error).toContain('idSirio');
    http.expectNone(`${environment.api.antaresAuth}user/add`);
  });

  it('bloquea contact si el nodo seleccionado no tiene idSirio, aunque la cuenta sí lo tenga', async () => {
    prepararLiquidacionPendiente();
    component.cuentaComercio = { commerceGuid: 'commerce-del-get', idSirio: 'NO-USAR', idUser: 405 };
    component.arbol = [{ id: 'sin-sirio', nombre: 'Sucursal', nivel: 'sucursal' }];
    component.nodoSeleccionado = 'sin-sirio';
    component.liquidacionForm.patchValue({ idInstitution: 90646, idActivity: 12 });
    component.liquidacionForm.disable();
    await adjuntar('carta');
    await adjuntar('edc');
    component.continuarLiquidacion();
    expect(component.error).toContain('idSirio del nodo seleccionado');
    http.expectNone(request => request.method === 'POST');
  });

  it('precarga la actividad del GET por ID sin marcar mismo beneficiario', () => {
    component.cuentaComercio = { typePerson: 'PF', idActivity: 1 };
    component['cargarFormulariosDesdeGet']();
    expect(component.liquidacionForm.controls.beneficiarioIgualComercio.value).toBeFalse();
    http.expectOne(request => request.url.endsWith('/getActividades')).flush([
      { idcat_actividades: 2, descripcion: 'Otra actividad' },
      { idcat_actividades: 1, descripcion: 'Estaciones de servicio y gasolinerías' }
    ]);
    expect(component.liquidacionForm.controls.idActivity.value).toBe(1);
    expect(component.liquidacionForm.controls.actividadBeneficiario.value).toBe('Estaciones de servicio y gasolinerías');
    expect(component.liquidacionForm.controls.giro.value).toBeNull();
  });

  it('precarga el giro de persona moral por businessActivityCode', () => {
    component.cuentaComercio = { typePerson: 'PM', businessActivityCode: '780' };
    component['cargarFormulariosDesdeGet']();
    const giro = http.expectOne(request => request.url.endsWith('/getGirosByFamily'));
    expect(giro.request.params.get('family')).toBe('780');
    giro.flush({ data: { rows: [
      { giro: 781, descripcion: 'Otro giro' },
      { giro: 780, descripcion: 'WYNN LAS VEGAS' }
    ] } });
    expect(component.liquidacionForm.controls.tipoPersonaBeneficiario.value).toBe('moral');
    expect(component.liquidacionForm.controls.giro.value).toBe(780);
    expect(component.liquidacionForm.controls.giroBeneficiario.value).toBe('WYNN LAS VEGAS');
    expect(component.liquidacionForm.controls.idActivity.value).toBeNull();
  });

  it('no inventa un giro cuando businessActivityCode está vacío', () => {
    component.cuentaComercio = { typePerson: 'PM', businessActivityCode: '' };
    component['cargarFormulariosDesdeGet']();
    expect(component.liquidacionForm.controls.giro.value).toBeNull();
    expect(component.liquidacionForm.controls.giroBeneficiario.invalid).toBeTrue();
    http.expectNone(request => request.url.endsWith('/getGirosByFamily'));
  });

  it('no sobrescribe la actividad que el usuario cambió durante la consulta', () => {
    component.cuentaComercio = { typePerson: 'PF', idActivity: 1 };
    component['cargarFormulariosDesdeGet']();
    component.liquidacionForm.patchValue({ idActivity: 2, actividadBeneficiario: 'Selección del usuario' });
    http.expectOne(request => request.url.endsWith('/getActividades')).flush([{ idcat_actividades: 1, descripcion: 'Original' }]);
    expect(component.liquidacionForm.controls.actividadBeneficiario.value).toBe('Selección del usuario');
  });

  for (const anterior of ['otros-bancos', 'otros-bancos-en-red']) {
    it(`cancelar En Red restaura ${anterior} sin completar ni enviar`, () => {
      prepararLiquidacionPendiente();
      component.liquidacionForm.controls.cuentaFueraRed.setValue(anterior);
      component['cambiarOpcionLiquidacion'](anterior);
      component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
      component['cambiarOpcionLiquidacion']('en-red');
      expect(component.modalLiquidacion).toBe('en-red');
      expect(component.liquidacionCompleta).toBeFalse();
      component.cancelarModalLiquidacion();
      expect(component.modalLiquidacion).toBeNull();
      expect(component.liquidacionForm.controls.cuentaFueraRed.value).toBe(anterior);
      expect(component.liquidacionForm.controls.nombreBeneficiario.enabled).toBeTrue();
      expect(component.liquidacionCompleta).toBeFalse();
      expect(component.pasoActivo).toBe('liquidacion');
      http.expectNone(request => request.method === 'POST');
    });
  }

});
