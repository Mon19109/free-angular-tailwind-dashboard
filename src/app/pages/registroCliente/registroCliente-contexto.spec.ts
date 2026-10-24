import { AuthService } from '../../services/auth.service';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role } });
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

  it('oculta validación en el DOM para roles 3–6 sin alterar el componente de prerregistro', () => {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(response());
    fixture.componentInstance.nodoSeleccionado = ref;
    fixture.componentInstance.seccionAbierta = 'documentos';
    fixture.componentInstance.documentosProspecto = [{ ref: other, name: 'Documento real', status: 'IN_REVIEW' }];
    const auth = TestBed.inject(AuthService);
    for (const role of [3, 4, 5, 6, 2]) {
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role } });
      fixture.detectChanges();
      const group = fixture.nativeElement.querySelector('.mesa-switch');
      expect(group).not.toBeNull();
      expect(getComputedStyle(group).display === 'none').toBe(role !== 2);
      expect(group.querySelector('button').disabled).toBeTrue();
      const header = fixture.nativeElement.querySelector('.mesa-table-head > span:last-child');
      expect(getComputedStyle(header).display === 'none').toBe(role !== 2);
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
      auth.actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: role } });
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

});
