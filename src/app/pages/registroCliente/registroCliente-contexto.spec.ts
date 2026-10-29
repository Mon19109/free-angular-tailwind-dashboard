import { AuthService } from '../../services/auth.service';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { RegistroClienteComponent } from './registroCliente.component';

const ref = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const response = (selected = ref) => ({ success: true, commerce: { ref: selected, nameCommerce: 'Comercio real',
  businessName: 'Razón real', rfc: 'RFC', email: 'fixture@example.test', phoneNumber: '123', status: 'ACTIVO', nivel: 'Entidad' },
  navigation: { path: '/registro_cliente', actionLabel: 'Editar Comercio' }, capabilities: {} });

describe('Registro Cliente con contexto BFF', () => {
  let params: BehaviorSubject<any>;
  let http: HttpTestingController;
  let component: RegistroClienteComponent;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ ref, nodeID: 'ignorar', commerceID: 'ignorar' }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }
    ] });
    http = TestBed.inject(HttpTestingController);
    spyOn(localStorage, 'getItem').and.throwError('No leer storage');
    component = TestBed.runInInjectionContext(() => new RegistroClienteComponent());
  });
  afterEach(() => {
    for (const request of http.match(req => /\/(pld|documentos)$/.test(req.url))) {
      if (!request.cancelled) request.flush({}, { status: 503, statusText: 'Unavailable' });
    }
    http.verify();
  });
  it('reutiliza formularios con datos del contexto y no ejecuta servicios legacy', () => {
    const request = http.expectOne(`/api/comercios/${ref}/contexto`);
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.params.keys()).toEqual([]);
    request.flush(response());
    expect(component.datosForm.getRawValue().nombreComercial).toBe('Comercio real');
    expect(component.datosForm.getRawValue().razonSocial).toBe('Razón real');
    expect(component.datosForm.disabled).toBeTrue();
    expect(component.arbol).toEqual([]);
    expect(component.puedeEditarDatosNodo).toBeFalse();
    component.guardarDatosNodo();
    for (const method of ['consultarArbolEdicion', 'consultarCuentaComercio', 'consultarResultadoSiprelad', 'consultarDocumentosProspecto', 'guardarRevisionDocumentos']) {
      (component as any)[method]();
    }
    http.expectNone(request => !request.url.startsWith('/api/comercios/'));
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('renderiza los formularios existentes sin iniciar peticiones legacy', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    fixture.componentInstance.seccionAbierta = 'datos';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Comercio real');
    const values = Array.from(fixture.nativeElement.querySelectorAll('input')).map((input: any) => input.value);
    expect(values).toContain('Comercio real');
    expect(fixture.componentInstance.datosForm.controls.razonSocial.value).toBe('Razón real');
    fixture.componentInstance.datosForm.controls.tipoPersona.setValue('PM');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="razonSocial"]').value).toBe('Razón real');
    expect(fixture.nativeElement.querySelector('.tree-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.footer-actions')).toBeNull();
    http.expectNone(request => !/\/(pld|documentos)$/.test(request.url));
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('carga y renderiza el árbol BFF con referencias opacas y sin servicios legacy', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    const req = http.expectOne(`/api/comercios/${ref}/arbol`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ success: true, tree: [
      { ref, name: 'Entidad real', levelType: 4, depth: 0, status: 1 },
      { ref: other, name: 'Sucursal real', levelType: 5, depth: 1, status: 1 }
    ] });
    const rootAccount = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`);
    rootAccount.flush({ code: 'COMERCIOS_ACCOUNT_IDENTITY_UNVERIFIED' }, { status: 503, statusText: 'Unavailable' });
    const screen = fixture.componentInstance;
    expect(screen.arbol[0].id).toBe(ref);
    expect(screen.arbol[0].hijos?.[0].id).toBe(other);
    expect(screen.arbol[0].hijos?.[0].nivel).toBe('sucursal');
    expect(screen.cargandoArbol).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tree-panel')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Entidad real');
    screen.seleccionarNodo(screen.arbol[0].hijos![0]);
    expect(screen.nodoSeleccionado).toBe(other);
    const account = http.expectOne(`/api/comercios/${ref}/nodos/${other}/informacion-general`);
    expect(account.request.withCredentials).toBeTrue();
    expect(account.request.headers.has('Authorization')).toBeFalse();
    expect(account.request.params.keys()).toEqual([]);
    account.flush({ code: 'COMERCIOS_ACCOUNT_IDENTITY_UNVERIFIED' }, { status: 503, statusText: 'Unavailable' });
    expect(screen.errorCuentaComercio).toContain('pertenencia');
    expect(screen.datosForm.getRawValue().rfc).toBe('');
    http.expectNone(request => !/\/(pld|documentos)$/.test(request.url));
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('conserva árbol vacío y muestra errores BFF sin fallback', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [] });
    expect(component.arbol).toEqual([]);
    expect(component.errorArbol).toBe('');
    (component as any).consultarArbolEdicion();
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({}, { status: 502, statusText: 'Bad Gateway' });
    expect(component.arbol).toEqual([]);
    expect(component.errorArbol).not.toBe('');
    expect(component.cargandoArbol).toBeFalse();
  });
  it('cancela el árbol pendiente al cambiar de comercio', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    const tree = http.expectOne(`/api/comercios/${ref}/arbol`);
    params.next(convertToParamMap({ ref: other }));
    expect(tree.cancelled).toBeTrue();
    expect(component.arbol).toEqual([]);
    http.expectOne(`/api/comercios/${other}/contexto`).flush(response(other));
    expect(component.nodoSeleccionado).toBe('');
  });
  it('limpia el comercio anterior y no lo muestra si el siguiente contexto falla', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    params.next(convertToParamMap({ ref: other }));
    expect(component.contextoBff).toBeNull();
    expect(component.contextoSeleccionado.nombreComercial).toBe('');
    http.expectOne(`/api/comercios/${other}/contexto`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.contextoBff).toBeNull();
    expect(component.errorContexto).not.toBe('');
  });
  it('cancela respuestas anteriores y rechaza contextos de otra referencia', () => {
    const first = http.expectOne(`/api/comercios/${ref}/contexto`);
    params.next(convertToParamMap({ ref: other }));
    expect(first.cancelled).toBeTrue();
    http.expectOne(`/api/comercios/${other}/contexto`).flush(response(ref));
    expect(component.contextoBff).toBeNull();
    expect(component.errorContexto).not.toBe('');
    params.next(convertToParamMap({ ref: '' }));
    http.expectNone(request => !/\/(pld|documentos)$/.test(request.url));
  });
  it('selecciona entidad, sucursal y caja; cancela consultas anteriores y limpia los formularios', () => {
    const caja = '33333333-3333-4333-8333-333333333333';
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [
      { ref, name: 'Entidad', levelType: 4, depth: 0 },
      { ref: other, name: 'Sucursal', levelType: 5, depth: 1 },
      { ref: caja, name: 'Caja', levelType: 6, depth: 2 }
    ] });
    const entidad = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`);
    const sucursal = component.arbol[0].hijos![0];
    component.datosForm.patchValue({ rfc: 'Anterior', nombreComercial: 'Anterior' });
    component.seleccionarNodo(sucursal);
    expect(entidad.cancelled).toBeTrue();
    expect(() => entidad.flush({ entityInfo: { nameCommerce: 'Tardío' } })).toThrow();
    expect(component.datosForm.getRawValue().rfc).toBe('');
    const solicitudSucursal = http.expectOne(`/api/comercios/${ref}/nodos/${other}/informacion-general`);
    component.seleccionarNodo(sucursal.hijos![0]);
    expect(solicitudSucursal.cancelled).toBeTrue();
    const solicitudCaja = http.expectOne(`/api/comercios/${ref}/nodos/${caja}/informacion-general`);
    expect(component.comercioForm.getRawValue().nivel).toBe('Caja');
    solicitudCaja.flush({ code: 'COMERCIOS_ACCOUNT_IDENTITY_UNVERIFIED' }, { status: 503, statusText: 'Unavailable' });
    expect((component as any).cuentaNodoActual).toBeNull();
    expect(component.datosForm.disabled).toBeTrue();
    expect(component.contextoSeleccionado.nombreComercial).toBe('Caja');
    http.expectNone(request => !request.url.startsWith('/api/comercios/'));
  });
  it('rechaza datos inesperados y conserva vacíos ante sesión expirada, permisos y referencias inválidas', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [
      { ref, name: 'Entidad', levelType: 4, depth: 0 }
    ] });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ entityInfo: { nameCommerce: 'No autorizado' } });
    expect(component.datosForm.getRawValue().nombreComercial).toBe('');
    for (const status of [401, 403, 404, 502]) {
      component.seleccionarNodo(component.arbol[0]);
      http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({}, { status, statusText: 'Error' });
      expect(component.cargandoCuentaComercio).toBeFalse();
      expect(component.errorCuentaComercio).not.toBe('');
      expect((component as any).cuentaNodoActual).toBeNull();
    }
    component.seleccionarNodo({ id: other, nombre: 'Ajeno', nivel: 'caja' });
    http.expectNone(request => !/\/(pld|documentos)$/.test(request.url));
    component.seleccionarNodo(component.arbol[0]);
    const pending = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`);
    params.next(convertToParamMap({ ref: other }));
    expect(pending.cancelled).toBeTrue();
    http.expectOne(`/api/comercios/${other}/contexto`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.contextoBff).toBeNull();
    expect(component.cargandoCuentaComercio).toBeFalse();
  });

  it('pinta cuenta, contactos, domicilios, PLD y documentos autorizados sin llamadas legacy', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [
      { ref, name: 'Entidad', levelType: 4, depth: 0 },
      { ref: other, name: 'Sucursal', levelType: 5, depth: 1 }
    ] });
    const root = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`);
    const oldPld = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`);
    const oldDocs = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`);
    component.seleccionarNodo(component.arbol[0].hijos![0]);
    expect(root.cancelled).toBeTrue(); expect(oldPld.cancelled).toBeTrue(); expect(oldDocs.cancelled).toBeTrue();
    const account = http.expectOne(`/api/comercios/${ref}/nodos/${other}/informacion-general`);
    expect(account.request.withCredentials).toBeTrue();
    expect(account.request.headers.has('Authorization')).toBeFalse();
    account.flush({ success: true, information: { nameCommerce: 'Sucursal real', businessName: 'Razón', rfc: 'RFC',
      email: 'fixture@example.test', fiscalRegime: '601', activityDescription: 'Actividad', businessActivityCode: '1234',
      contacts: [{ type: 1, name: 'Representante', address: { street: 'Calle', postalCode: '01000' } }],
      commerceAddress: [{ addressType: 'DF', roadName: 'Fiscal', postalCode: '02000' }] } });
    const data = component.datosForm.getRawValue();
    expect(data.nombreComercial).toBe('Sucursal real'); expect(data.nombreRepresentante).toBe('Representante');
    expect(data.calleRepresentante).toBe('Calle'); expect(data.nombreVialidad).toBe('Fiscal');
    expect(data.nombreVialidadComercial).toBe('Fiscal'); expect(data.actividad).toBe('Actividad');
    expect(component.comercioForm.getRawValue().nivel).toBe('Sucursal');
    expect(component.datosForm.disabled).toBeTrue();
    http.expectOne(`/api/comercios/${ref}/nodos/${other}/pld`).flush({ success: true, pld: [
      { nombre: 'Coincidencia', rfc: 'RFC', fechaRegistro: '2026-01-01', coincidenciaListas: 'Si', categoria: null, fuente: null }
    ] });
    http.expectOne(`/api/comercios/${ref}/nodos/${other}/documentos`).flush({ success: true, documents: [
      { ref: '33333333-3333-4333-8333-333333333333', name: 'Documento real', documentType: 'LEGAL', status: 'APPROVED' }
    ] });
    expect(component.resultadosSiprelad[0].nombre).toBe('Coincidencia');
    expect(component.documentosVisibles.length).toBe(1);
    expect(component.documentacionSoloConsulta).toBeTrue();
    expect(component.commerceID).toBe(''); expect(component.pldID).toBe('');
    http.expectNone(request => true);
  });
  it('caja omite documentos; vacío y 503 no simulan resultados', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [
      { ref, name: 'Caja', levelType: 6, depth: 0 }
    ] });
    http.expectNone(`/api/comercios/${ref}/nodos/${ref}/documentos`);
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ success: true, information: {} });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.errorCuentaComercio).toContain('No hay información');
    expect(component.resultadoSiprelad).toContain('503');
    expect(component.documentosVisibles).toEqual([]);
  });

  it('conserva nombre público real y abre solamente el archivo BFF de la selección actual', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    component.nodoSeleccionado = ref;
    component.documentosProspecto = [{ ref: other, name: 'Acta constitutiva real.pdf', status: 'APPROVED' }];
    const doc = component.documentosVisibles[0];
    expect(doc.nombre).toBe('Acta constitutiva real.pdf');
    expect(doc.archivoUrl).toBe(`/api/comercios/${ref}/nodos/${ref}/documentos/${other}/archivo`);
    const open = spyOn(window, 'open');
    component.verDocumentoProspecto(doc);
    expect(open).toHaveBeenCalledWith(doc.archivoUrl, '_blank', 'noopener,noreferrer');
    component.documentosProspecto = [];
    open.calls.reset(); component.verDocumentoProspecto(doc);
    expect(open).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('solo rol 2 ve revisión; no guarda validaciones locales como si fueran persistidas', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const auth = TestBed.inject(AuthService);
    for (const role of [2, 3, 4, 5, 6]) {
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role as any } });
      expect(component.puedeVerRevisionDocumental).toBe(role === 2);
      expect(component.documentacionSoloConsulta).toBeTrue();
      const doc = { numero: 1, nombre: 'Acta', obligatorio: false, estatusRevision: 'IN_REVIEW' as const };
      component.actualizarEstatusDocumento(doc, 'APPROVED');
      expect(doc.estatusRevision).toBe('IN_REVIEW');
    }
    auth.clearSession(); expect(component.puedeVerRevisionDocumental).toBeFalse();
    http.expectNone(request => true);
  });
  it('reutiliza resumen real de dispersión y distingue acceso false de ausencia', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    for (const [access, expected] of [[true, true], [false, false], [null, null]] as const) {
      (component as any).limpiarDetalleBff();
      (component as any).pintarCuentaComercio({ nameCommerce: 'Nodo', dispersionAccount: 'NETWORK', hasPlatformAccess: access }, 'Empresa Grupo');
      expect(component.opcionLiquidacionConsulta).toBe('En Red');
      expect(component.accesosDisponiblesBff).toBe(expected);
      expect(component.datosForm.disabled).toBeTrue();
    }
    (component as any).limpiarDetalleBff();
    (component as any).pintarCuentaComercio({ dispersionAccount: null, hasPlatformAccess: null }, 'Empresa Grupo');
    expect(component.opcionLiquidacionConsulta).toBe('');
    expect(component.accesosDisponiblesBff).toBeNull();
    http.expectNone(request => true);
  });

  it('no crea controles administrativos para roles distintos de 2 sin alterar prerregistro', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    fixture.componentInstance.nodoSeleccionado = ref;
    fixture.componentInstance.seccionAbierta = 'documentos';
    fixture.componentInstance.documentosProspecto = [{ ref: other, name: 'Documento real', status: 'IN_REVIEW' }];
    (fixture.componentInstance as any).observacionesInternasCargadasBff = true;
    const auth = TestBed.inject(AuthService);
    for (const role of [1, 3, 4, 5, 6, undefined, null, 'invalid', 2]) {
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role as any } });
      fixture.detectChanges();
      const group = fixture.nativeElement.querySelector('.mesa-switch');
      expect(!!group).toBe(role === 2);
      if (group) expect(group.querySelector('button').disabled).toBeTrue();
      expect(fixture.nativeElement.querySelectorAll('.mesa-table-head > span').length).toBe(role === 2 ? 5 : 4);
      if (role !== 2) {
        expect(fixture.nativeElement.querySelector('.mesa-register-action')).toBeNull();
        expect(fixture.nativeElement.querySelector('.mesa-observations')).toBeNull();
        expect(fixture.nativeElement.querySelector('.mesa-switch')).toBeNull();
      } else {
        expect(fixture.nativeElement.querySelector('input[type=email]').readOnly).toBeTrue();
      }
    }
  });

  it('distingue dispersión desconocida de vacía y conserva las tres etiquetas originales', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    for (const [value, label] of [['NETWORK', 'En Red'], ['OTHER_BANK', 'Otros Bancos'],
      ['OTHER_BANK_AND_NETWORK', 'Otros Bancos y En Red'], ['UNKNOWN', ''], ['', ''], [null, ''], [undefined, '']]) {
      (component as any).cuentaNodoActual = { dispersionAccount: value };
      (component as any).pintarCuentaComercio({ dispersionAccount: value }, 'Empresa Grupo');
      expect(component.opcionLiquidacionConsulta).toBe(label as string);
      expect(component.liquidacionDesconocida).toBe(value === 'UNKNOWN');
    }
    http.expectNone(request => true);
  });

  it('conserva las etiquetas originales sin añadir un botón de edición provisional', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const view = fixture.componentInstance;
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true,
      expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    view.seccionAbierta = 'liquidacion';
    (view as any).pintarCuentaComercio({ dispersionAccount: 'OTHER_BANK_AND_NETWORK', hasPlatformAccess: true }, 'Empresa Grupo');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Otros Bancos y En Red');
    expect(fixture.nativeElement.textContent).not.toContain('Editar cuenta de liquidación');
    expect(fixture.nativeElement.textContent).not.toContain('Consulta disponible; edición pendiente.');
    view.seccionAbierta = 'accesos';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Este comercio cuenta con una cuenta registrada en la plataforma.');
    expect(fixture.nativeElement.textContent).toContain(view.usuariosAcceso[0].titulo);
    http.expectNone(request => true);
  });

  it('no ejecuta escrituras legacy ni simula guardados desde las acciones pendientes, incluso para rol 2', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const auth = TestBed.inject(AuthService);
    const modal = spyOn(component as any, 'mostrarModalRegistro');
    for (const role of [2, 3, 4, 5, 6]) {
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role as any } });
      const before = component.datosForm.getRawValue();
      component.editarDatosNodo();
      component.guardarDatosNodo();
      component.guardarRevisionDocumentos();
      component.enviarNotificacionMesaDigital();
      component.registrarClienteProspecto();
      component.finalizar();
      expect(component.editandoDatosNodo).toBeFalse();
      expect(component.datosForm.getRawValue()).toEqual(before);
      expect(component.datosForm.disabled).toBeTrue();
      expect(modal).not.toHaveBeenCalled();
      http.expectNone(request => true);
    }
  });

  it('mantiene las cinco columnas originales de PLD y sus seis campos públicos', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    fixture.componentInstance.seccionAbierta = 'documentos';
    fixture.componentInstance.resultadosSiprelad = [{ rfc: 'RFC-PRUEBA', nombre: 'Nombre de prueba',
      fechaRegistro: '2026-01-01', categoria: 'Categoría de prueba', fuente: 'Fuente de prueba', coincidenciaListas: 'Si' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.siprelad-head span').length).toBe(5);
    const row = fixture.nativeElement.querySelector('.siprelad-row').textContent;
    for (const value of ['RFC-PRUEBA', 'Nombre de prueba', '2026-01-01', 'Categoría de prueba', 'Fuente de prueba', 'Sí']) {
      expect(row).toContain(value);
    }
    expect(fixture.nativeElement.querySelector('.mesa-observations')).toBeNull();
    http.expectNone(request => true);
  });

  it('edita con permiso BFF, manda solo cambios públicos y recarga el nodo', () => {
    const auth = TestBed.inject(AuthService);
    auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [{ ref, name: 'Comercio', levelType: 4, depth: 0 }] });
    const result = { success: true, information: { nameCommerce: 'Anterior' }, permissions: { editInformation: true, editFields: ['nombreComercial'] } };
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush(result);
    expect(component.puedeEditarDatosNodo).toBeTrue();
    component.editarDatosNodo();
    component.datosForm.controls.nombreComercial.setValue('Nuevo');
    component.guardarDatosNodo();
    const write = http.expectOne(r => r.method === 'PUT');
    expect(write.request.body).toEqual({ cambios: { nombreComercial: 'Nuevo' } });
    expect(write.request.withCredentials).toBeTrue();
    expect(write.request.headers.get('X-Portal-Request')).toBe('1');
    expect(write.request.headers.has('Authorization')).toBeFalse();
    write.flush({ success: true });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ ...result, information: { nameCommerce: 'Nuevo' } });
    expect(component.datosForm.controls.nombreComercial.value).toBe('Nuevo');
    expect(component.editandoDatosNodo).toBeFalse();
  });

  it('no mezcla una respuesta de guardado con otro nodo ni concede edición por rol solo', () => {
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [{ ref, name: 'Entidad', levelType: 4, depth: 0 }, { ref: other, name: 'Sucursal', levelType: 5, depth: 1 }] });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ success: true, information: { nameCommerce: 'Entidad' }, permissions: { editInformation: true, editFields: ['nombreComercial'] } });
    component.editarDatosNodo(); component.datosForm.controls.nombreComercial.setValue('Cambio'); component.guardarDatosNodo();
    const write = http.expectOne(r => r.method === 'PUT');
    component.seleccionarNodo((component as any).buscarNodo(component.arbol, other));
    http.expectOne(`/api/comercios/${ref}/nodos/${other}/informacion-general`).flush({ success: true, information: { nameCommerce: 'Sucursal' }, permissions: { editInformation: false, editFields: [] } });
    write.flush({ success: true });
    expect(component.datosForm.controls.nombreComercial.value).toBe('Sucursal');
    expect(component.puedeEditarDatosNodo).toBeFalse();
    http.expectNone(r => r.url.endsWith('informacion-general'));
  });

  function cargarRevision(permissions = { reviewDocuments: true, sendObservations: true, notificationEmail: 'cuenta@example.test' }) {
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [{ ref, name: 'Entidad', levelType: 4, depth: 0 }] });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ success: true, information: { nameCommerce: 'Entidad' }, permissions: { editInformation: false, editFields: [], editUnavailableCode: 'COMERCIOS_WRITE_ACCOUNT_MISMATCH' } });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({ success: true,
      documents: [{ ref: other, name: 'Acta', status: 'IN_REVIEW' }], internalObservations: 'Nota existente', permissions });
  }

  it('rechaza métodos administrativos con otro rol aunque conserve permisos BFF previos', () => {
    cargarRevision();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({ success: true, rows: [] });
    (component as any).edicionAutorizadaBff = true;
    (component as any).registroPermitidoBff = true;
    component.observacionesClienteMesaDigital = 'Comentario';
    const auth = TestBed.inject(AuthService);
    // Incluye valores malformados recibidos en tiempo de ejecución.
    for (const role of [1, 3, 4, 5, 6, undefined, null, 'invalid', [2]]) {
      auth.actualizarSesion({ success: true, authenticated: true,
        expiresAt: Date.now() + 60000, usuario: { idRol: role as any } });
      const doc = component.documentosVisibles[0];
      const before = doc.estatusRevision;
      component.actualizarEstatusDocumento(doc, 'APPROVED');
      component.editarDatosNodo();
      component.guardarDatosNodo();
      component.guardarRevisionDocumentos();
      component.enviarNotificacionMesaDigital();
      component.registrarClienteProspecto();
      component.finalizar();
      expect(doc.estatusRevision).toBe(before);
      expect(component.editandoDatosNodo).toBeFalse();
      expect(component.puedeVerRevisionDocumental).toBeFalse();
      http.expectNone(request => true);
    }
  });

  it('conserva notas existentes y persiste aprobación/rechazo con referencias, luego recarga', () => {
    cargarRevision();
    expect(component.codigoEdicionBff).toBe('COMERCIOS_WRITE_ACCOUNT_MISMATCH');
    expect(component.documentacionSoloConsulta).toBeFalse();
    const doc = component.documentosVisibles[0];
    component.actualizarEstatusDocumento(doc, 'APPROVED');
    component.actualizarEstatusDocumento(doc, 'REJECTED');
    component.guardarRevisionDocumentos();
    component.guardarRevisionDocumentos();
    const req = http.expectOne(r => r.method === 'PUT');
    expect(req.request.url).toBe(`/api/comercios/${ref}/nodos/${ref}/documentos/revision`);
    expect(req.request.body).toEqual({ documents: [{ ref: other, status: 'REJECTED' }], internalObservations: 'Nota existente' });
    expect(req.request.withCredentials).toBeTrue(); expect(req.request.headers.get('X-Portal-Request')).toBe('1');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({ success: true, documents: [{ ref: other, name: 'Acta', status: 'REJECTED' }], internalObservations: 'Nota existente', permissions: { reviewDocuments: true, sendObservations: true, notificationEmail: 'cuenta@example.test' } });
    expect(component.observacionesInternasMesaDigital).toBe('Nota existente');
    expect(component.documentosProspecto[0].status).toBe('REJECTED');
  });

  it('envía el correo editado y observaciones, evita duplicados y conserva el comentario ante error', () => {
    cargarRevision(); component.observacionesClienteMesaDigital = 'Revisar documento';
    component.emailNotificacionMesaDigital = 'no-enviar@example.test';
    component.enviarNotificacionMesaDigital(); component.enviarNotificacionMesaDigital();
    const req = http.expectOne(r => r.method === 'POST');
    expect(req.request.url).toBe(`/api/comercios/${ref}/nodos/${ref}/documentos/observaciones`);
    expect(req.request.body).toEqual({ observations: 'Revisar documento', email: 'no-enviar@example.test' });
    expect(req.request.headers.get('X-Portal-Request')).toBe('1'); expect(req.request.withCredentials).toBeTrue();
    req.flush({}, { status: 502, statusText: 'Backend error' });
    expect(component.observacionesClienteMesaDigital).toBe('Revisar documento');
    component.enviarNotificacionMesaDigital();
    http.expectOne(r => r.method === 'POST').flush({ success: true });
    expect(component.observacionesClienteMesaDigital).toBe('');
  });

  it('denegación BFF impide revisión y envío aunque el usuario sea rol 2', () => {
    cargarRevision({ reviewDocuments: false, sendObservations: false, notificationEmail: null as any });
    component.guardarRevisionDocumentos(); component.enviarNotificacionMesaDigital();
    expect(component.documentacionSoloConsulta).toBeTrue();
    http.expectNone(r => ['PUT', 'POST'].includes(r.method));
  });

  it('no borra notas ausentes del contrato y descarta respuestas de un contexto anterior', () => {
    cargarRevision(); component.observacionesClienteMesaDigital = 'Nota vieja'; component.enviarNotificacionMesaDigital();
    const req = http.expectOne(r => r.method === 'POST');
    (component as any).limpiarDetalleBff(); component.nodoSeleccionado = other;
    component.observacionesClienteMesaDigital = 'Nota nueva';
    req.flush({ success: true });
    expect(component.observacionesClienteMesaDigital).toBe('Nota nueva');
    expect(component.puedeRevisarDocumentosBff).toBeFalse();
    component.guardarRevisionDocumentos(); http.expectNone(r => r.method === 'PUT');
  });

  it('permite capturar correo vacío y rechaza formatos inválidos y cajas sin enviar', () => {
    cargarRevision({reviewDocuments:true,sendObservations:true,notificationEmail:null as any});
    component.observacionesClienteMesaDigital = 'Comentario';
    expect(component.puedeNotificarBff).toBeTrue();
    for (const email of ['', 'invalid', 'one@example.test,two@example.test', 'x\r\n@example.test', 'a'.repeat(65)+'@example.test', 'x@'+'a'.repeat(250)+'.com']) {
      component.emailNotificacionMesaDigital = email;
      component.enviarNotificacionMesaDigital();
      http.expectNone(r => r.method === 'POST');
    }
    component.emailNotificacionMesaDigital = 'nuevo@example.test';
    const nivel = spyOnProperty(component, 'nivelSeleccionado', 'get').and.returnValue('caja');
    component.enviarNotificacionMesaDigital(); http.expectNone(r => r.method === 'POST');
    nivel.and.returnValue('entidad');
    component.enviarNotificacionMesaDigital();
    const req = http.expectOne(r => r.method === 'POST');
    expect(req.request.body).toEqual({email:'nuevo@example.test',observations:'Comentario'});
    req.flush({success:true});
  });

  it('solo presenta filas y estadísticas confirmadas; distingue carga, vacío y errores', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[{ref,name:'Entidad',levelType:4,depth:0}]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({success:true,pld:[]});
    const view = fixture.componentInstance; view.seccionAbierta = 'documentos';
    const docsUrl = `/api/comercios/${ref}/nodos/${ref}/documentos`;
    fixture.detectChanges(); expect(view.estadoDocumentosBff).toBe('loading');
    expect(fixture.nativeElement.querySelector('.mesa-results')).toBeNull();
    http.expectOne(docsUrl).flush({success:true,documents:[
      {ref:'doc-a',name:'Acta real',status:'APPROVED'}, {ref:'doc-b',name:'Otro real',status:'REJECTED'},
      {ref:'doc-c',name:'Pendiente real',status:'IN_REVIEW'}, {ref:'doc-d',name:'Sin estado',status:null}]});
    fixture.detectChanges(); expect(view.documentosVisibles.length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.mesa-row').length).toBe(4);
    const summary = fixture.nativeElement.querySelector('.mesa-results').textContent;
    expect(summary).toContain('Documentos Totales: 4'); expect(summary).toContain('Aprobados: 1');
    expect(summary).toContain('Rechazados: 1'); expect(summary).toContain('Pendientes: 1');
    for (const status of [400,401,403,404,500,502,503,0,-1]) {
      (view as any).consultarDocumentosProspecto(); fixture.detectChanges();
      expect(view.documentosVisibles).toEqual([]); expect(fixture.nativeElement.querySelector('.mesa-results')).toBeNull();
      const req = http.expectOne(docsUrl);
      if (status > 0) req.flush({}, {status,statusText:'Failure'});
      else if (status === 0) req.error(new ProgressEvent('timeout'));
      else req.flush({success:true,documents:[{}]});
      fixture.detectChanges(); expect(view.estadoDocumentosBff).toBe('error');
      expect(view.documentosVisibles).toEqual([]);
      expect(fixture.nativeElement.querySelector('.mesa-results')).toBeNull();
      expect(fixture.nativeElement.querySelector('.mesa-row')).toBeNull();
      expect(view.errorDocumentosProspecto).toBe(status === 403 ? 'No tienes autorización para consultar los documentos' : 'No fue posible consultar los documentos');
      expect(fixture.nativeElement.textContent).not.toContain('No hay documentos disponibles');
    }
    (view as any).consultarDocumentosProspecto(); http.expectOne(docsUrl).flush({success:true,documents:[]});
    fixture.detectChanges(); expect(view.estadoDocumentosBff).toBe('empty');
    expect(fixture.nativeElement.textContent).toContain('No hay documentos disponibles');
    expect(fixture.nativeElement.querySelector('.mesa-results')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mesa-table')).toBeNull();
    expect(view.documentosVisibles).toEqual([]);
  });

  it('limpia documentos confirmados al cambiar de nodo y cancela la respuesta pendiente anterior', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[
      {ref,name:'Entidad',levelType:4,depth:0},{ref:other,name:'Sucursal',levelType:5,depth:1}]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,documents:[{ref:'doc',name:'Anterior',status:'APPROVED'}]});
    expect(component.documentosVisibles.length).toBe(1);
    component.seleccionarNodo(component.arbol[0].hijos![0]);
    expect(component.documentosVisibles).toEqual([]); expect(component.estadoDocumentosBff).toBe('loading');
    const pending = http.expectOne(`/api/comercios/${ref}/nodos/${other}/documentos`);
    const pendingAccount = http.expectOne(`/api/comercios/${ref}/nodos/${other}/informacion-general`);
    component.seleccionarNodo(component.arbol[0]);
    expect(pending.cancelled).toBeTrue(); expect(pendingAccount.cancelled).toBeTrue();
    expect(component.documentosVisibles).toEqual([]);
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,documents:[]});
    expect(component.documentosVisibles).toEqual([]); expect(component.estadoDocumentosBff).toBe('empty');
  });

  it('permite revisar con permiso BFF aunque no incluya observaciones internas', () => {
    cargarRevision();
    (component as any).consultarDocumentosProspecto();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({ success: true,
      documents: [{ ref: other, name: 'Acta', status: 'APPROVED' }],
      permissions: { reviewDocuments: true, sendObservations: false, notificationEmail: null } });
    expect(component.puedeRevisarDocumentosBff).toBeTrue();
    expect(component.puedeNotificarBff).toBeFalse();
    component.guardarRevisionDocumentos();
    const write = http.expectOne(r => r.method === 'PUT');
    expect(write.request.body).toEqual({documents:[{ref:other,status:'APPROVED'}],internalObservations:null});
    write.flush({success:false});
  });

  it('restaura controles y permite editar el destinatario autorizado sin modificar los datos del comercio', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    const view = fixture.componentInstance;
    view.seccionAbierta = 'documentos'; view.nodoSeleccionado = ref;
    view.documentosProspecto = [{ ref: other, name: 'Acta', status: 'IN_REVIEW' }];
    (view as any).revisionPermitidaBff = true; (view as any).notificacionPermitidaBff = true;
    (view as any).observacionesInternasCargadasBff = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa-observations')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.mesa-switch button').disabled).toBeFalse();
    const input = fixture.nativeElement.querySelector('input[type=email]') as HTMLInputElement;
    expect(input.readOnly).toBeFalse();
    expect(input.maxLength).toBe(254);
    const before = view.datosForm.getRawValue();
    input.value = 'alternativo@example.test'; input.dispatchEvent(new Event('input'));
    expect(view.emailNotificacionMesaDigital).toBe('alternativo@example.test');
    expect(view.datosForm.getRawValue()).toEqual(before);
    expect(fixture.nativeElement.textContent).toContain('Guardar Borrador');
    expect(fixture.nativeElement.textContent).toContain('Enviar Notificación');
  });

  it('oculta campos administrativos de observaciones incluso con notas cargadas para otros roles', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 3 } });
    const view = fixture.componentInstance;
    view.seccionAbierta = 'documentos'; view.nodoSeleccionado = ref;
    view.observacionesInternasMesaDigital = 'Nota autorizada por el servidor';
    (view as any).observacionesInternasCargadasBff = true;
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('.mesa-observations input');
    expect(inputs.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.mesa-observations')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mesa-register-action')).toBeNull();
    view.guardarRevisionDocumentos(); view.enviarNotificacionMesaDigital();
    http.expectNone(r => ['PUT', 'POST'].includes(r.method));
    (view as any).limpiarDetalleBff(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa-observations')).toBeNull();
  });

  it('renderiza Editar datos sin permisos documentales y lo retira al denegar edición', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ ...response(), capabilities: { tree: true } });
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [{ ref, name: 'Entidad', levelType: 4, depth: 0 }] });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ success: true, information: { nameCommerce: 'Entidad' }, permissions: { editInformation: true, editFields: ['nombreComercial'] } });
    const view = fixture.componentInstance;
    view.seccionAbierta = 'datos'; fixture.detectChanges();
    const edit = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.trim() === 'Editar datos') as HTMLButtonElement;
    expect(edit).toBeTruthy(); edit.click(); fixture.detectChanges();
    expect(view.datosForm.controls.nombreComercial.enabled).toBeTrue();
    expect(view.datosForm.controls.razonSocial.disabled).toBeTrue();
    (view as any).edicionAutorizadaBff = false;
    view.guardarDatosNodo(); fixture.detectChanges();
    expect(view.puedeEditarDatosNodo).toBeFalse();
    http.expectNone(r => r.method === 'PUT');
  });

  it('rol 2 ve Editar aun con guardado denegado; otros roles no lo ven', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const view = fixture.componentInstance;
    view.seccionAbierta = 'datos';
    for (const role of [2, 3, 4, 5, 6]) {
      TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role as any } });
      fixture.detectChanges();
      const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.trim() === 'Editar datos') as HTMLButtonElement | undefined;
      expect(!!button).toBe(role === 2);
      if (button) { expect(button.disabled).toBeTrue(); button.click(); }
      view.guardarDatosNodo();
    }
    expect(view.editandoDatosNodo).toBeFalse();
    http.expectNone(r => r.method === 'PUT');
  });

  it('muestra el motivo de destinatario denegado y lo limpia al cambiar de nodo', () => {
    cargarRevision();
    (component as any).consultarDocumentosProspecto();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({ success: true,
      documents: [{ ref: other, name: 'Acta', status: 'IN_REVIEW' }], internalObservations: 'Nota',
      permissions: { reviewDocuments: true, sendObservations: false, notificationEmail: null,
        notificationUnavailableCode: 'COMERCIOS_WRITE_ACCOUNT_MISMATCH' } });
    expect(component.codigoNotificacionBff).toBe('COMERCIOS_WRITE_ACCOUNT_MISMATCH');
    expect(component.puedeRevisarDocumentosBff).toBeTrue();
    expect(component.puedeNotificarBff).toBeFalse();
    (component as any).limpiarDetalleBff();
    expect(component.codigoNotificacionBff).toBe('');
  });

  it('guarda revisión antes de registrar con referencias opacas y confirma respuesta real', () => {
    cargarRevision();
    (component as any).registroPermitidoBff = true;
    expect(component.mostrarRegistrarClienteDocumentos).toBeTrue();
    component.actualizarEstatusDocumento(component.documentosVisibles[0], 'APPROVED');
    component.continuarDesdeDocumentos();
    http.expectOne(r => r.method === 'PUT').flush({success:true});
    const registration = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/registrar`);
    expect(registration.request.method).toBe('POST');
    expect(registration.request.body).toEqual({});
    expect(registration.request.withCredentials).toBeTrue();
    expect(registration.request.headers.get('X-Portal-Request')).toBe('1');
    expect(registration.request.headers.has('Authorization')).toBeFalse();
    component.registrarClienteProspecto();
    http.expectNone(r => r.method === 'POST');
    registration.flush({success:true});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,documents:[],internalObservations:null,
      permissions:{reviewDocuments:false,sendObservations:false,registerClient:false,notificationEmail:null}});
    expect(component.registrandoCliente).toBeFalse();
    expect(component.mostrarRegistrarClienteDocumentos).toBeFalse();
  });

  for (const status of [400, 409, 502]) {
    it(`no interpreta HTTP ${status} como duplicado ni muestra mensajes crudos o reintenta el registro`, () => {
      cargarRevision();
      (component as any).registroPermitidoBff = true;
      component.documentosProspecto[0].status = 'APPROVED';
      component.registrarClienteProspecto();
      const request = http.expectOne(`/api/comercios/${ref}/nodos/${ref}/registrar`);
      request.flush({ success: false, code: 'COMERCIOS_REVIEW_UNAVAILABLE',
        message: 'PRIVATE_PROVIDER_MESSAGE', error: { message: 'PRIVATE_PROVIDER_MESSAGE' } },
        { status, statusText: 'Failure' });
      expect(component.registrandoCliente).toBeFalse();
      expect(component.mensajeObservacionesCliente).toContain('No fue posible registrar el cliente.');
      expect(component.mensajeObservacionesCliente).not.toContain('PRIVATE_PROVIDER_MESSAGE');
      expect(component.mensajeObservacionesCliente).not.toContain('ya cuenta');
      http.expectNone(r => r.method === 'POST');
    });
  }

  it('REGISTER 409/4002 reutiliza el popup de error con Aceptar sin navegar ni reintentar', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    TestBed.inject(AuthService).actualizarSesion({success:true,authenticated:true,expiresAt:Date.now()+60000,usuario:{idRol:2}});
    const fixture=TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[{ref,name:'Entidad',levelType:4,depth:0}]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({success:true,pld:[]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,documents:[{ref:other,name:'Acta',status:'APPROVED'}],
      permissions:{reviewDocuments:true,sendObservations:false,registerClient:true,notificationEmail:null}});
    const navigate=spyOn(TestBed.inject(Router),'navigate');
    const navigateByUrl=spyOn(TestBed.inject(Router),'navigateByUrl');
    const view=fixture.componentInstance;
    view.registrarClienteProspecto();
    const req=http.expectOne(`/api/comercios/${ref}/nodos/${ref}/registrar`);
    const message='El prospecto ya cuenta con un enlace activo, verifique o reporte al Administrador.';
    req.flush({success:false,code:'4002',message},{status:409,statusText:'Conflict'});
    fixture.detectChanges();
    expect(view.modalRegistro).toEqual({visible:true,tipo:'error',titulo:'Error al registrar cliente',mensaje:message});
    const modal=fixture.nativeElement.querySelector('.registro-modal-backdrop');
    expect(modal.querySelector('.registro-modal-icon.error')).not.toBeNull();
    expect(modal.querySelector('h2').textContent).toBe('Error al registrar cliente');
    expect(modal.querySelector('p').textContent).toBe(message);
    const button=modal.querySelector('button');expect(button.textContent.trim()).toBe('Aceptar');
    expect(view.registrandoCliente).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();expect(navigateByUrl).not.toHaveBeenCalled();
    http.expectNone(r=>r.method==='POST');
    button.click();fixture.detectChanges();expect(view.modalRegistro.visible).toBeFalse();
  });

  it('código desconocido o mensaje no aprobado no abre popup ni publica texto del proveedor', () => {
    cargarRevision();(component as any).registroPermitidoBff=true;component.documentosProspecto[0].status='APPROVED';
    for (const code of ['OTHER','4002']) {
      component.registrarClienteProspecto();
      http.expectOne(`/api/comercios/${ref}/nodos/${ref}/registrar`).flush({success:false,code,message:'PRIVATE_PROVIDER_TEXT'},{status:409,statusText:'Conflict'});
      expect(component.modalRegistro.visible).toBeFalse();
      expect(component.mensajeObservacionesCliente).not.toContain('PRIVATE_PROVIDER_TEXT');
      http.expectNone(r=>r.method==='POST');
    }
  });

  it('sin permiso de registro no activa, aunque se invoque el método directamente', () => {
    cargarRevision();
    component.registrarClienteProspecto();
    expect(component.mostrarRegistrarClienteDocumentos).toBeFalse();
    http.expectNone(r => r.method === 'POST');
  });

  it('Registrar es independiente de revisar/enviar y no escribe otra revisión innecesaria', () => {
    cargarRevision({reviewDocuments:false,sendObservations:false,notificationEmail:null as any});
    (component as any).registroPermitidoBff = true;
    component.documentosProspecto[0].status = 'APPROVED';
    expect(component.documentacionSoloConsulta).toBeFalse();
    expect(component.mostrarRegistrarClienteDocumentos).toBeTrue();
    expect(component.puedeFinalizarDocumentosBff).toBeTrue();
    component.continuarDesdeDocumentos();
    http.expectNone(r => r.method === 'PUT');
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/registrar`).flush({code:'COMERCIOS_REGISTER_DOCUMENTS_PENDING'}, {status:409,statusText:'Conflict'});
    expect(component.mensajeObservacionesCliente).toContain('COMERCIOS_REGISTER_DOCUMENTS_PENDING');
    expect(component.registrandoCliente).toBeFalse();
  });

  it('documentos rechazados pueden revisarse, pero no permiten registrar hasta aprobarlos', () => {
    cargarRevision(); (component as any).registroPermitidoBff = true;
    for (const status of ['REJECTED', 'IN_REVIEW']) {
      component.documentosProspecto[0].status = status;
      expect(component.puedeRevisarDocumentosBff).toBeTrue();
      expect(component.mostrarRegistrarClienteDocumentos).toBeTrue();
      expect(component.puedeFinalizarDocumentosBff).toBeFalse();
      component.registrarClienteProspecto(); component.continuarDesdeDocumentos();
      http.expectNone(r => ['PUT','POST'].includes(r.method));
    }
    component.actualizarEstatusDocumento(component.documentosVisibles[0], 'APPROVED');
    expect(component.puedeFinalizarDocumentosBff).toBeTrue();
    TestBed.inject(AuthService).actualizarSesion({success:true,authenticated:true,expiresAt:Date.now()+60000,usuario:{idRol:3}});
    expect(component.mostrarRegistrarClienteDocumentos).toBeFalse();
    expect(component.puedeFinalizarDocumentosBff).toBeFalse();
  });

  it('conserva la causa de configuración PLD sin presentar una consulta vacía exitosa', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[{ref,name:'Entidad',levelType:4,depth:0}]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({success:false,code:'COMERCIOS_PLD_CONFIG_UNAVAILABLE'}, {status:503,statusText:'Unavailable'});
    expect(component.resultadoSiprelad).toContain('COMERCIOS_PLD_CONFIG_UNAVAILABLE');
    expect(component.resultadosSiprelad).toEqual([]);
  });

  it('un rechazo de envío conserva observaciones y no cambia el diagnóstico de revisión', () => {
    cargarRevision(); component.observacionesClienteMesaDigital = 'Observación pendiente';
    component.codigoRevisionBff = 'COMERCIOS_REVIEW_ACTOR_UNAVAILABLE';
    component.enviarNotificacionMesaDigital();
    http.expectOne(r => r.method === 'POST').flush({code:'COMERCIOS_REVIEW_RECIPIENT_UNAVAILABLE'}, {status:422,statusText:'Unprocessable Entity'});
    expect(component.codigoNotificacionBff).toBe('COMERCIOS_REVIEW_RECIPIENT_UNAVAILABLE');
    expect(component.codigoRevisionBff).toBe('COMERCIOS_REVIEW_ACTOR_UNAVAILABLE');
    expect(component.observacionesClienteMesaDigital).toBe('Observación pendiente');
    expect(component.puedeNotificarBff).toBeFalse();
    expect(component.puedeRevisarDocumentosBff).toBeTrue();
  });

  it('mantiene visible el error BFF aunque la denegación oculte los controles de escritura', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    fixture.componentInstance.seccionAbierta = 'documentos';
    fixture.componentInstance.mensajeObservacionesCliente = 'No fue posible guardar la revisión. COMERCIOS_REVIEW_STATUS_FORBIDDEN';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa-register-action')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('COMERCIOS_REVIEW_STATUS_FORBIDDEN');
  });

  it('recarga permisos actuales tras un error documental, sin que PLD los bloquee', () => {
    cargarRevision({reviewDocuments:false,sendObservations:false,notificationEmail:null as any});
    (component as any).consultarDocumentosProspecto();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({}, {status:503,statusText:'Unavailable'});
    expect(component.puedeRevisarDocumentosBff).toBeFalse();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({code:'COMERCIOS_PLD_CONFIG_UNAVAILABLE'}, {status:503,statusText:'Unavailable'});
    (component as any).consultarDocumentosProspecto();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,
      documents:[{ref:other,name:'Acta',status:'IN_REVIEW'}],internalObservations:'Conservar',
      permissions:{reviewDocuments:true,sendObservations:true,notificationEmail:'cuenta@example.test'}});
    expect(component.errorDocumentosProspecto).toBe('');
    expect(component.puedeRevisarDocumentosBff).toBeTrue();
    expect(component.puedeNotificarBff).toBeTrue();
    expect(component.resultadoSiprelad).toContain('COMERCIOS_PLD_CONFIG_UNAVAILABLE');
    component.actualizarEstatusDocumento(component.documentosVisibles[0],'APPROVED');
    component.guardarRevisionDocumentos();
    const write=http.expectOne(r=>r.method==='PUT');
    expect(write.request.body.documents).toEqual([{ref:other,status:'APPROVED'}]);
    write.flush({success:false});
    component.observacionesClienteMesaDigital='Revisar'; component.enviarNotificacionMesaDigital();
    const send=http.expectOne(r=>r.method==='POST');
    expect(send.request.body).toEqual({observations:'Revisar',email:'cuenta@example.test'}); send.flush({success:true});
  });

  it('mantiene permisos independientes y los revoca al recargar, sin nodo o sin sesión', () => {
    cargarRevision({reviewDocuments:true,sendObservations:false,notificationEmail:null as any});
    expect(component.puedeRevisarDocumentosBff).toBeTrue(); expect(component.puedeNotificarBff).toBeFalse();
    (component as any).consultarDocumentosProspecto();
    expect(component.puedeRevisarDocumentosBff).toBeFalse();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,
      documents:[{ref:other,name:'Acta',status:'IN_REVIEW'}],internalObservations:null,
      permissions:{reviewDocuments:false,sendObservations:true,notificationEmail:'cuenta@example.test'}});
    expect(component.puedeRevisarDocumentosBff).toBeFalse(); expect(component.puedeNotificarBff).toBeTrue();
    component.guardarRevisionDocumentos(); http.expectNone(r=>r.method==='PUT');
    component.nodoSeleccionado=''; expect(component.puedeNotificarBff).toBeFalse();
    component.nodoSeleccionado=ref;
    TestBed.inject(AuthService).actualizarSesion({success:false,authenticated:false});
    expect(component.puedeNotificarBff).toBeFalse(); expect(component.puedeRevisarDocumentosBff).toBeFalse();
  });

  it('botones renderizados permiten clic y emiten únicamente los contratos BFF autorizados', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    TestBed.inject(AuthService).actualizarSesion({success:true,authenticated:true,expiresAt:Date.now()+60000,usuario:{idRol:2}});
    const fixture=TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[{ref,name:'Entidad',levelType:4,depth:0}]});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({success:true,information:{nameCommerce:'Entidad'}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/pld`).flush({code:'COMERCIOS_PLD_CONFIG_UNAVAILABLE'},{status:503,statusText:'Unavailable'});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos`).flush({success:true,
      documents:[{ref:other,name:'Acta',status:'IN_REVIEW'}],permissions:{reviewDocuments:true,sendObservations:true,notificationEmail:'cuenta@example.test'}});
    const view=fixture.componentInstance; view.seccionAbierta='documentos'; fixture.detectChanges();
    const buttons=fixture.nativeElement.querySelectorAll('.mesa-switch button');
    expect(buttons.length).toBe(2); expect(buttons[0].disabled).toBeFalse(); expect(buttons[1].disabled).toBeFalse();
    buttons[0].click(); buttons[1].click(); fixture.detectChanges();
    const find=(label:string):HTMLButtonElement => Array.from(fixture.nativeElement.querySelectorAll('button')).find((button:any)=>button.textContent.includes(label)) as HTMLButtonElement;
    const save=find('Guardar Borrador'); expect(save.disabled).toBeFalse(); save.click();
    const write=http.expectOne(r=>r.method==='PUT');
    expect(write.request.body).toEqual({documents:[{ref:other,status:'REJECTED'}],internalObservations:null});
    write.flush({success:false});
    view.observacionesClienteMesaDigital='Comentario autorizado'; fixture.detectChanges();
    const send=find('Enviar Notificación'); expect(send.disabled).toBeFalse(); send.click();
    const notification=http.expectOne(r=>r.method==='POST');
    expect(notification.request.body).toEqual({observations:'Comentario autorizado',email:'cuenta@example.test'}); notification.flush({success:true});
  });

});
