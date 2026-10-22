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
    expect(fixture.nativeElement.textContent).toContain('Razón real');
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

});
