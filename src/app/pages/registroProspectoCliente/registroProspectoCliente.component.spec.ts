import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
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
    spyOn(window, 'close');
    spyOn<any>(component, 'salirPaginaEnBlanco');
    component.cuentaComercio = { commerceGuid: 'commerce-del-get' };
    component.link = 'link-prospecto';
    component.arbol = [{ id: 'inicial', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUC000', levelType: 5 }];
    component.nodoSeleccionado = 'inicial';
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('abre y cierra secciones internas sin enviar ni validar formularios', () => {
    component.modoInterno = true;
    component.seccionInternaChange.subscribe(seccion => component.seccionInterna = seccion);
    const guardar = spyOn(component, 'continuarLiquidacion');
    component.alternarSeccionFinal('liquidacion');
    expect(component.seccionFinalAbierta).toBe('liquidacion');
    component.alternarSeccionFinal('liquidacion');
    expect(component.seccionFinalAbierta).toBeNull();
    component.alternarSeccionFinal('accesos');
    expect(component.seccionFinalAbierta).toBe('accesos');
    component.alternarSeccionFinal('accesos');
    expect(component.seccionFinalAbierta).toBeNull();
    expect(guardar).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('no reinicia la carga del nodo al cambiar únicamente la sección interna', () => {
    component.modoInterno = true;
    component.cargando = true;
    component.ngOnChanges({ seccionInterna: {
      previousValue: null, currentValue: 'accesos', firstChange: false, isFirstChange: () => false
    } });
    expect(component.cargando).toBeTrue();
    http.expectNone(() => true);
  });

  it('reutiliza el GET inicial de entidad y consulta y registra la sucursal con el Sirio de su nodo', () => {
    component.prospecto = { idSirio: 'SUB0204400', nodeId: 4602 } as any;
    component.consultarCuentaComercio();
    const entidad = http.expectOne(req => req.url.endsWith('account/get'));
    expect(entidad.request.params.get('sirioId')).toBe('SUB0204400');
    entidad.flush({ entityInfo: {
      idSirio: 'SUB0204400', nodeId: 4602,
      dispersionAccount: 'NETWORK', hasPlatformAccess: true
    } });
    http.expectOne(req => req.url.endsWith('/nodes/4602/tree')).flush([
      { idStatus: 26, idSirio: 'SUB0204400', levelType: 4, idNode: 4602, name: 'Farmacias del Centro', depth: 0 },
      { idStatus: 25, idSirio: 'SUB0204448850', levelType: 5, idNode: 4603, name: 'Farmacias del Centro', depth: 1 },
      { idStatus: 0, idSirio: 'SUB0204448856079', levelType: 6, idNode: 4604, name: 'Caja test', depth: 2 }
    ]);
    http.expectNone(req => req.url.endsWith('account/get'));
    expect(component.nodoSeleccionado).toBe('4602');
    expect(component.accesosCompletos).toBeTrue();

    component.seleccionarNodo('4603');
    const sucursal = http.expectOne(req => req.url.endsWith('account/get'));
    expect(sucursal.request.params.get('sirioId')).toBe('SUB0204448850');
    // Aunque account/get incluya el ID del padre, el envío usa el nodo del árbol.
    sucursal.flush({ entityInfo: {
      idSirio: 'SUB0204400', dispersionAccount: 'NETWORK',
      hasPlatformAccess: false, typeOfBusiness: 5
    } });
    expect(component.contextoSirio).toBe('SUB0204448850');
    expect(component.accesosCompletos).toBeFalse();
    llenar('controlador');
    component.finalizar();
    const acceso = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(acceso.request.body.sirioId).toBe('SUB0204448850');
    expect(acceso.request.body.idAffiliationLevel).toBe(5);
    expect(acceso.request.body.idProfile).toBe(9);
    acceso.flush({ success: true });
    completarSeguimiento().flush({ success: true });

    component.seleccionarNodo('4604');
    expect(component.nodoRequiereAccesos).toBeFalse();
    expect(component.cuentaComercio).toBeNull();
    component.consultarCuentaComercio();
    component.finalizar();
    http.expectNone(() => true);

    component.seleccionarNodo('4602');
    expect(component.contextoSirio).toBe('SUB0204400');
    expect(component.accesosCompletos).toBeTrue();
    http.expectNone(req => req.url.endsWith('account/get'));
  });

  it('sale a una página en blanco sin aviso si el navegador bloquea el cierre', fakeAsync(() => {
    component.errorProspecto = 'Enlace ya fue completado.';
    component.cerrarPagina();
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(component['salirPaginaEnBlanco']).not.toHaveBeenCalled();
    tick(100);
    expect(component['salirPaginaEnBlanco']).toHaveBeenCalledTimes(1);
  }));

  it('la X y Cancelar del token intentan cerrar y salen del registro si el navegador lo impide', fakeAsync(() => {
    component.showTokenModal = true;
    component.closeTokenModal();
    expect(window.close).toHaveBeenCalledTimes(1);
    tick(100);
    expect(component['salirPaginaEnBlanco']).toHaveBeenCalledTimes(1);
  }));

  function iniciarModoInterno() {
    component.modoInterno = true;
    component.link = '';
    component.nodoSeleccionado = '';
    component.arbolInterno = [{
      id: 'entidad', nombre: 'Entidad', nivel: 'entidad', idSirio: 'ENT002', levelType: 4,
      hijos: [{ id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUC001', levelType: 5 },
        { id: 'caja', nombre: 'Caja', nivel: 'caja', idSirio: 'CAJ003', levelType: 6 }]
    }];
    component.nodoInterno = 'entidad';
    spyOn(localStorage, 'getItem').and.callFake(key => key === 'token' ? 'sesion-interna' : null);
    component.ngOnChanges();
    component.ngOnInit();
    const cuenta = http.expectOne(req => req.url.endsWith('account/get'));
    expect(cuenta.request.params.get('sirioId')).toBe('ENT002');
    expect(cuenta.request.headers.get('Authorization')).toBe('Bearer sesion-interna');
    cuenta.flush({ entityInfo: { idSirio: 'ENT002', commerceGuid: 'guid-entidad', dispersionAccount: '' } });
  }

  it('usa la sesión interna para liquidación y avanza por nodo sin SMS ni enlace externo', () => {
    iniciarModoInterno();
    expect(component.showTokenModal).toBeFalse();
    expect(component.cargando).toBeFalse();
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.aceptarModalLiquidacion();
    const dispersion = http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`);
    expect(dispersion.request.headers.get('Authorization')).toBe('Bearer sesion-interna');
    expect(dispersion.request.body.commerceGuid).toBe('guid-entidad');
    dispersion.flush({ success: true });
    llenar('admin');
    component.finalizar();
    const acceso = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(acceso.request.body.sirioId).toBe('ENT002');
    acceso.flush({ success: true });
    const avanzar = spyOn(component.nodoInternoChange, 'emit');
    component.aceptarModalAccesos();
    expect(avanzar).toHaveBeenCalledWith('sucursal');
    component.nodoInterno = 'sucursal';
    component.ngOnChanges();
    expect(component.liquidacionCompleta).toBeFalse();
    consultarNodo('SUC001', 'NETWORK');
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    expect(component.accesosCompletos).toBeTrue();
    http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
    component.nodoInterno = 'caja';
    component.ngOnChanges();
    expect(component.nodoRequiereAccesos).toBeFalse();
    component.continuarLiquidacion();
    component.finalizar();
    http.expectNone(() => true);
  });

  it('envía la cuenta bancaria interna y documentos con la sesión y Sirio ID del nodo', async () => {
    iniciarModoInterno();
    await adjuntar('carta');
    await adjuntar('edc');
    component.liquidacionForm.patchValue({
      cuentaFueraRed: 'otros-bancos', tipoPersonaBeneficiario: 'fisica',
      nombreBeneficiario: 'Ana', apellidoPaternoBeneficiario: 'Perez', apellidoMaternoBeneficiario: 'Lopez',
      correoBeneficiario: 'ana@example.com', direccionBeneficiario: 'Calle 1', rfcBeneficiario: 'AAAA010101AAA',
      actividadBeneficiario: 'Actividad', idActivity: 12, tipoCuenta: 'CLABE', cuentaClabe: '646180289216322143',
      nombreBanco: 'STP', idInstitution: 90646, accountNumber: '0', direccionBanco: 'Calle 2',
      telefonoBanco: '5512345678', emailBanco: 'banco@example.com'
    });
    component.continuarLiquidacion();
    http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`).flush({ success: true });
    const documentos = http.expectOne(`${environment.api.documents}uploadFiles`);
    expect(documentos.request.headers.get('Authorization')).toBe('Bearer sesion-interna');
    expect(documentos.request.body.get('folderName')).toBe('guid-entidad');
    documentos.flush({ success: true });
    const cuenta = http.expectOne(`${environment.api.KashpayCoreAPI}contact`);
    expect(cuenta.request.headers.get('Authorization')).toBe('Bearer sesion-interna');
    expect(cuenta.request.body.identifier).toBe('ENT002');
    cuenta.flush({ success: true });
    expect(component.liquidacionCompleta).toBeTrue();
  });

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

  for (const formato of ['entityInfo', 'account', 'data']) {
    it(`reconoce hasPlatformAccess junto a ${formato} y evita volver a enviar accesos`, () => {
      prepararAccesos('en-red');
      component.seleccionarNodo('entidad');
      http.expectOne(req => req.url.endsWith('account/get')).flush({
        hasPlatformAccess: true,
        [formato]: { idSirio: 'ENT002', dispersionAccount: 'NETWORK' }
      });
      expect(component.accesosCompletos).toBeTrue();
      expect(component.nodoRegistroCompleto('entidad')).toBeTrue();
      component.finalizar();
      http.expectNone(`${environment.api.antaresAuth}user/add`);
      http.expectNone(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);

      component.seleccionarNodo('sucursal');
      expect(component.accesosCompletos).toBeFalse();
      expect(component.nodoRegistroCompleto('entidad')).toBeTrue();
      component.seleccionarNodo('entidad');
      expect(component.accesosCompletos).toBeTrue();
    });
  }

  it('permite capturar y enviar cuando la cuenta tiene hasPlatformAccess false', () => {
    prepararAccesos('en-red');
    component.seleccionarNodo('entidad');
    http.expectOne(req => req.url.endsWith('account/get')).flush({
      hasPlatformAccess: true,
      entityInfo: { idSirio: 'ENT002', dispersionAccount: 'NETWORK', hasPlatformAccess: false }
    });
    expect(component.accesosCompletos).toBeFalse();
    expect(component.accesosForm.controls.adminNombre.enabled).toBeTrue();
    expect(component.pasoActivo).toBe('accesos');
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    expect(component.accesosCompletos).toBeTrue();
  });

  it('marca solo accesos como concluido si la liquidación aún está pendiente', () => {
    prepararAccesos('en-red');
    component.seleccionarNodo('entidad');
    http.expectOne(req => req.url.endsWith('account/get')).flush({
      entityInfo: { hasPlatformAccess: true, dispersionAccount: '' }
    });
    expect(component.accesosCompletos).toBeTrue();
    expect(component.liquidacionCompleta).toBeFalse();
    expect(component.nodoRegistroCompleto('entidad')).toBeFalse();
    component.seleccionarNodo('sucursal');
    expect(component.nodoRegistroCompleto('entidad')).toBeFalse();
  });

  for (const [typeOfBusiness, prefijo, titulo] of [
    [5, 'controlador', 'Usuario Controlador de Recursos'],
    [17, 'supervisor', 'Usuario Supervisor de Terminales']
  ] as const) {
    for (const dispersionAccount of ['NETWORK', 'OTHER_BANK', 'OTHER_BANK_AND_NETWORK']) {
      it(`envía el perfil correspondiente a typeOfBusiness ${typeOfBusiness} con ${dispersionAccount} para entidad`, () => {
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
          sirioId: 'ENT002', idAffiliationLevel: 4, idProfile: typeOfBusiness === 5 ? 9 : 8,
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

  for (const typeOfBusiness of [5, 17]) {
    for (const formato of ['entityInfo', 'account', 'data']) {
      it(`conserva typeOfBusiness ${typeOfBusiness} fuera de ${formato} para los accesos de sucursal`, () => {
        prepararAccesos('otros-bancos-en-red');
        component['consultarLiquidacionNodo']();
        const cuenta = { idSirio: 'SUC001', dispersionAccount: 'OTHER_BANK_AND_NETWORK' };
        http.expectOne(req => req.url.endsWith('account/get')).flush({
          success: true,
          typeOfBusiness: String(typeOfBusiness),
          [formato]: formato === 'data' ? { entityInfo: cuenta } : cuenta
        });

        const prefijo = typeOfBusiness === 5 ? 'controlador' : 'supervisor';
        expect(component.usuariosAcceso.map(usuario => usuario.prefijo)).toEqual([prefijo]);
        expect(component.usuarioActivo).toBe(prefijo);
        expect(component.contextoNivel).toBe('Sucursal');
        llenar(prefijo);
        component.finalizar();
        const acceso = http.expectOne(`${environment.api.antaresAuth}user/add`);
        expect(acceso.request.body.idProfile).toBe(typeOfBusiness === 5 ? 9 : 8);
        expect(acceso.request.body.idAffiliationLevel).toBe(5);
        expect(acceso.request.body.sirioId).toBe('SUC001');
        acceso.flush({ success: true });
        completarSeguimiento().flush({ success: true });

        component.seleccionarNodo('entidad');
        consultarNodo('ENT002', 'NETWORK');
        expect(component.contextoNivel).toBe('Entidad');
        expect(component.usuariosAcceso.map(usuario => usuario.prefijo)).toEqual(['admin']);
        component.seleccionarNodo('sucursal');
        expect(component.contextoNivel).toBe('Sucursal');
        expect(component.usuariosAcceso.map(usuario => usuario.prefijo)).toEqual([prefijo]);
      });
    }
  }

  it('prioriza el tipo de la cuenta sobre el tipo del contenedor', () => {
    prepararAccesos('otros-bancos-en-red');
    component['consultarLiquidacionNodo']();
    http.expectOne(req => req.url.endsWith('account/get')).flush({
      typeOfBusiness: 5,
      entityInfo: { typeOfBusiness: 17, dispersionAccount: 'OTHER_BANK_AND_NETWORK' }
    });
    expect(component.usuariosAcceso.map(usuario => usuario.prefijo)).toEqual(['supervisor']);
  });

  it('identifica la sucursal seleccionada en el encabezado aunque la cuenta diga Comercio', () => {
    prepararAccesos('en-red');
    component.cuentaComercio = { commerceType: 'Comercio', idSirio: 'SUB0204400' };
    expect(component.contextoNivel).toBe('Sucursal');
    expect(component.contextoSirio).toBe('SUC001');
    expect(component.contextoNombre).toBe('Sucursal');
  });

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

  it('cierra automáticamente la última sucursal tras confirmar el seguimiento y omite cajas', () => {
    prepararAccesos('otros-bancos');
    component.arbol = [component.arbol[0], component.arbol[2]];
    const cerrar = spyOn(component, 'cerrarPagina');
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    expect(cerrar).not.toHaveBeenCalled();
    completarSeguimiento().flush({ success: true });
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(component.modalAccesos).toBeNull();
    expect(component.nodoSeleccionado).toBe('sucursal');
    expect(component.accesosCompletos).toBeTrue();
    http.expectNone(() => true);
  });

  it('conserva la página si falla el seguimiento final y cierra al reintentarlo con éxito', () => {
    prepararAccesos('otros-bancos');
    component.arbol = [component.arbol[0]];
    const cerrar = spyOn(component, 'cerrarPagina');
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    completarSeguimiento().flush({ success: false });
    expect(cerrar).not.toHaveBeenCalled();
    expect(component.accesosCompletos).toBeFalse();
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
    completarSeguimiento().flush({ success: true });
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('actualiza el enlace y cierra cuando el último nodo es una entidad', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('entidad');
    consultarNodo('ENT002');
    component.arbol = [component.arbol[1]];
    const cerrar = spyOn(component, 'cerrarPagina');
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    expect(cerrar).not.toHaveBeenCalled();
    completarSeguimiento().flush({ success: true });
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(component.modalAccesos).toBeNull();
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

  it('mantiene abierta la página al completar el último nodo en modo interno', () => {
    prepararAccesos('en-red');
    component.modoInterno = true;
    component.arbol = [component.arbol[0], component.arbol[2]];
    llenar('admin');
    component.finalizar();
    http.expectOne(`${environment.api.antaresAuth}user/add`).flush({ success: true });
    const cerrar = spyOn(component, 'cerrarPagina');
    component.aceptarModalAccesos();
    expect(cerrar).not.toHaveBeenCalled();
    expect(component.accesosCompletos).toBeTrue();
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
    expect(fac.request.body).toEqual({ sirioId: 'SUC001', idAffiliationLevel: 5, idProfile: 7, name: 'Ana', paternalSurname: 'Perez', maternalSurname: 'Lopez', email: 'fac@example.com', phoneNumber: '5512345678' });
    fac.flush({ success: true });
    const tkt = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(tkt.request.body.idProfile).toBe(5);
    tkt.flush({ success: false });
    expect(component.accesosCompletos).toBeFalse();
    expect(component.modalAccesos).toBeNull();
    component.finalizar();
    const reintento = http.expectOne(`${environment.api.antaresAuth}user/add`);
    expect(reintento.request.body.idProfile).toBe(5);
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

  for (const [modo, perfil] of [['otros-bancos', 1], ['en-red', 1]] as const) {
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
