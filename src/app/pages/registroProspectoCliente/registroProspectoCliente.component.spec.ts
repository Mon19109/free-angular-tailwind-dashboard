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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function adjuntar(tipo: 'carta' | 'edc', archivo = new File(['%PDF-1.7 contenido'], `${tipo}.pdf`, { type: 'application/pdf' })) {
    await component['asignarArchivoLiquidacion'](archivo, tipo);
  }

  function consulta() {
    component.consultarLiquidacion();
    return http.expectOne(request => request.url === `${environment.api.kashpay}api/v1/svc-8a7f3c/v2/h7q2_x91`);
  }

  it('usa el GUID del get y permite continuar con accesos cuando existe una cuenta', () => {
    const request = consulta();
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('idUser')).toBe('commerce-del-get');
    expect(request.request.params.get('type')).toBe('CL');
    for (const key of ['contextID', 'entityID', 'terminalID', 'terminalUserID']) {
      expect(request.request.params.get(key)).toBe('0');
    }
    expect(request.request.headers.get('versionApp')).toBe('3');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${component.prospectoBearerToken}`);
    expect(component.liquidacionConsultada).toBeFalse();
    request.flush([{ id: 'cuenta-existente' }]);
    expect(component.liquidacionCompleta).toBeTrue();
    expect(component.pasoActivo).toBe('accesos');
    component.volverLiquidacion();
    expect(component.pasoActivo).toBe('accesos');
    component.continuarLiquidacion();
    expect(component.error).toBe('');
  });

  it('permite capturar y exige validar el formulario si devuelve una lista vacía', () => {
    consulta().flush([]);
    expect(component.liquidacionConsultada).toBeTrue();
    expect(component.liquidacionExistente).toBeFalse();
    expect(component.liquidacionCompleta).toBeFalse();
    component.continuarLiquidacion();
    expect(component.pasoActivo).toBe('liquidacion');
    expect(component.error).not.toBe('');
  });

  it('permite reintentar un error sin interpretarlo como una cuenta vacía', () => {
    consulta().flush({}, { status: 500, statusText: 'Error' });
    expect(component.liquidacionConsultada).toBeFalse();
    expect(component.cargandoLiquidacion).toBeFalse();
    expect(component.errorLiquidacion).not.toBe('');
    consulta().flush([{ id: 'cuenta' }]);
    expect(component.errorLiquidacion).toBe('');
    expect(component.liquidacionCompleta).toBeTrue();
  });

  it('rechaza respuestas que no sean listas', () => {
    consulta().flush({ success: false });
    expect(component.liquidacionConsultada).toBeFalse();
    expect(component.errorLiquidacion).not.toBe('');
  });
  it('completa En Red al aceptar sin registrar una cuenta bancaria', () => {
    consulta().flush([]);
    component.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    component.continuarLiquidacion();
    expect(component.modalLiquidacion).toBe('en-red');
    expect(component.liquidacionCompleta).toBeFalse();
    component.aceptarModalLiquidacion();
    expect(component.liquidacionCompleta).toBeTrue();
    expect(component.pasoActivo).toBe('accesos');
    http.expectNone(request => request.method === 'POST');
  });

  for (const tipo of ['fisica', 'moral'] as const) {
    it(`registra ${tipo} con su catálogo y no completa antes del éxito`, async () => {
      consulta().flush([]);
      component.cuentaComercio = { commerceGuid: 'commerce-del-get', idSirio: 'NO-USAR-CUENTA' };
      component.arbol = [
        { id: 'raiz', nombre: 'Entidad', nivel: 'entidad', idSirio: 'NO-USAR-RAIZ' },
        { id: 'seleccionado', nombre: 'Sucursal', nivel: 'sucursal', idSirio: 'SUB0048790' }
      ];
      component.nodoSeleccionado = 'seleccionado';
      await adjuntar('carta');
      await adjuntar('edc');
      component.liquidacionForm.patchValue({
        tipoPersonaBeneficiario: tipo,
        nombreBeneficiario: 'Ana', apellidoPaternoBeneficiario: 'Perez', apellidoMaternoBeneficiario: 'Lopez',
        correoBeneficiario: 'ana@example.com', direccionBeneficiario: 'Calle 1', rfcBeneficiario: 'AAAA010101AAA',
        actividadBeneficiario: 'Actividad', idActivity: 12, giroBeneficiario: 'WYNN LAS VEGAS', giro: 780,
        tipoCuenta: 'CLABE', cuentaClabe: '646180289216322143', nombreBanco: 'STP', idInstitution: 90646,
        accountNumber: '0', direccionBanco: 'Calle 2', telefonoBanco: '5512345678', emailBanco: 'banco@example.com'
      });
      component.continuarLiquidacion();
      http.expectOne(`${environment.api.documents}createDirectory`).flush({ success: true });
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
      component.continuarLiquidacion();
      http.expectNone(`${environment.api.KashpayCoreAPI}contact`);
      request.flush({ success: true });
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
    component.liquidacionConsultada = true;
    component.liquidacionRegistrada = true;
    component.liquidacionForm.controls.cuentaFueraRed.setValue(modo);
    component.seleccionarNodo('sucursal');
  }

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
    expect(component.accesosCompletos).toBeTrue();
    expect(component.modalAccesos).toBe('Sucursal');
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
    component.seleccionarNodo('entidad');
    expect(component.accesosCompletos).toBeFalse();
    expect(component.accesosForm.controls.facNombre.value).toBe('');
    component.seleccionarNodo('sucursal');
    expect(component.accesosCompletos).toBeTrue();
  });

  for (const [modo, perfil] of [['otros-bancos', 7], ['en-red', 5]] as const) {
    it(`envía un administrador con perfil ${perfil} para el nodo seleccionado`, () => {
      prepararAccesos(modo);
      component.seleccionarNodo('entidad');
      llenar('admin');
      component.finalizar();
      const request = http.expectOne(`${environment.api.antaresAuth}user/add`);
      expect(request.request.body.idProfile).toBe(perfil);
      expect(request.request.body.sirioId).toBe('ENT002');
      expect(request.request.body.idAffiliationLevel).toBe(4);
      request.flush({ success: true });
      expect(component.accesosCompletos).toBeTrue();
      expect(component.modalAccesos).toBe('Entidad');
    });
  }

  it('no envía accesos para cajas', () => {
    prepararAccesos('otros-bancos');
    component.seleccionarNodo('caja');
    component.finalizar();
    http.expectNone(`${environment.api.antaresAuth}user/add`);
  });

  it('requiere ambos documentos y bloquea el registro si falla la carga', async () => {
    consulta().flush([]);
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
    http.expectNone(request => request.method === 'POST');
    await adjuntar('carta');
    component.continuarLiquidacion();
    expect(component.error).toContain('Adjunta');
    http.expectNone(request => request.method === 'POST');
    await adjuntar('edc');
    component.continuarLiquidacion();
    const directorio = http.expectOne(`${environment.api.documents}createDirectory`);
    expect(directorio.request.headers.get('Authorization')).toBe(`Bearer ${component.prospectoBearerToken}`);
    directorio.flush({ success: true });
    http.expectOne(`${environment.api.documents}uploadFiles`).flush({ success: false });
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
    consulta().flush([]);
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

});
