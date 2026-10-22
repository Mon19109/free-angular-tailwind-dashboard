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
  afterEach(() => http.verify());
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
    http.expectNone(request => true);
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
    http.expectNone(request => true);
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
    http.expectNone(request => true);
  });
});
