import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RegistroClienteComponent } from './registroCliente.component';

const ref = '11111111-1111-4111-8111-111111111111';
const doc = '22222222-2222-4222-8222-222222222222';
const context = (status: number) => ({ success: true, commerce: { ref, status: String(status), nameCommerce: 'Entidad' }, capabilities: { tree: true }, navigation: {} });
const progress = { rootStatus: 35, selectedApproved: true, canRegister: true, nextRef: null, nodes: [{ ref, name: 'Entidad', pending: [] }] };
describe('Registrar después de guardar una revisión documental confirmada', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<RegistroClienteComponent>;
  beforeEach(() => {
    // Consulta y Dashboard navegan al mismo componente con queryParams: { ref }.
    const params = new BehaviorSubject(convertToParamMap({ ref }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true, expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
    fixture = TestBed.createComponent(RegistroClienteComponent);
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  const url = `/api/comercios/${ref}/nodos/${ref}/documentos`;
  const response = (permissions: any = {}, status = 'APPROVED') => ({ success: true,
    documents: [{ ref: doc, name: 'Acta', status }], permissions: { reviewDocuments: true, sendObservations: true,
      selectedCommerceStatus: 35, reviewProgress: progress, ...permissions } });
  function load(permissions: any = {}, status = 'APPROVED', commerceStatus = 35) {
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(context(commerceStatus));
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [{ ref, name: 'Entidad', levelType: 4, depth: 0 }] });
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush({ success: true, information: { nameCommerce: 'Entidad' } });
    for (const req of http.match(r => r.url.endsWith('/pld'))) req.flush({ success: true, pld: [] });
    http.expectOne(url).flush(response(permissions, status));
    fixture.componentInstance.seccionAbierta = 'documentos'; fixture.detectChanges();
  }
  const register = (): HTMLButtonElement | undefined => Array.from(fixture.nativeElement.querySelectorAll('button'))
    .find((button: any) => /Registrar/.test(button.textContent)) as HTMLButtonElement | undefined;

  it('conserva la obligación original de guardar antes de Registrar en estatus 35', () => {
    load(); expect(register()).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Entidad: documentos');
    http.expectNone(r => r.method === 'PUT' || r.method === 'POST');
  });
  for (const [name, permissions, state] of [
    ['pendientes', { reviewProgress: { ...progress, selectedApproved: false, canRegister: false } }, 'IN_REVIEW'],
    ['sin autorización de registro', { reviewProgress: { ...progress, canRegister: false } }, 'APPROVED'],
    ['sin revisión confirmada', { reviewProgress: { ...progress, selectedApproved: false } }, 'APPROVED'],
    ['sin permisos', { reviewDocuments: false, sendObservations: false }, 'APPROVED'],
    ['sin progreso confirmado', { reviewProgress: undefined }, 'APPROVED'],
    ['otro estatus', { selectedCommerceStatus: 31, registerClient: false }, 'APPROVED'],
  ] as const) it(`no muestra Registrar con ${name}`, () => {
    load(permissions, state); expect(register()).toBeUndefined();
  });
  it('guardar confirma Registrar sin una segunda consulta que borre el progreso', () => {
    load({}, 'IN_REVIEW'); const c = fixture.componentInstance;
    c.actualizarEstatusDocumento(c.documentosVisibles[0], 'APPROVED');
    c.guardarRevisionDocumentos(); c.guardarRevisionDocumentos();
    expect(c.procesandoRevisionDocumental).toBeTrue();
    http.expectOne(`${url}/revision`).flush({ success: true, reviewProgress: progress });
    // The write response already confirms persistence, permissions and the tree.
    http.expectNone(`/api/comercios/${ref}/contexto`); http.expectNone(url);
    fixture.detectChanges();
    expect(c.procesandoRevisionDocumental).toBeFalse();
    expect(c.modalRegistro.tipo).toBe('success');
    c.cerrarModalRegistro(); fixture.detectChanges();
    expect(register()).toBeDefined(); expect(register()?.disabled).toBeFalse();
    c.actualizarEstatusDocumento(c.documentosVisibles[0], 'REJECTED'); fixture.detectChanges();
    expect(register()).toBeUndefined();
    c.actualizarEstatusDocumento(c.documentosVisibles[0], 'APPROVED'); fixture.detectChanges();
    expect(register()).toBeUndefined(); // A local edit still needs a confirmed save.
    http.expectNone(r => r.method === 'POST');
  });
  for (const confirmed of [undefined, { ...progress, canRegister: false, selectedApproved: false }]) {
    it(`guardar sin autorización de registro no muestra Registrar: ${JSON.stringify(confirmed)}`, () => {
      load(); const c = fixture.componentInstance;
      c.guardarRevisionDocumentos();
      http.expectOne(`${url}/revision`).flush({ success: true, reviewProgress: confirmed });
      c.cerrarModalRegistro(); fixture.detectChanges();
      expect(register()).toBeUndefined();
    });
  }
  it('Registrar conserva su endpoint y espera confirmación del BFF tras guardar', () => {
    load(); const c = fixture.componentInstance;
    c.guardarRevisionDocumentos();
    http.expectOne(`${url}/revision`).flush({ success: true, reviewProgress: progress });
    c.cerrarModalRegistro(); fixture.detectChanges(); register()!.click();
    expect(c.procesandoRevisionDocumental).toBeTrue();
    const request = http.expectOne(`${url}/registrar`);
    expect(request.request.body).toEqual({});
    request.flush({ success: true, idStatus: 31 });
    http.expectOne(`/api/comercios/${ref}/contexto`).flush(context(31));
    http.expectOne(url).flush(response({ selectedCommerceStatus: 31, reviewProgress: undefined, registerClient: false }));
    c.cerrarModalRegistro(); fixture.detectChanges();
    expect(c.procesandoRevisionDocumental).toBeFalse(); expect(register()).toBeUndefined();
  });
  it('estatus 26 conserva la validación original de documentos aprobados', () => {
    load({ selectedCommerceStatus: 26, reviewProgress: undefined }, 'IN_REVIEW', 26);
    expect(register()).toBeUndefined();
    const c = fixture.componentInstance;
    c.actualizarEstatusDocumento(c.documentosVisibles[0], 'APPROVED'); fixture.detectChanges();
    expect(register()?.textContent).toContain('Registrar Cliente');
    c.actualizarEstatusDocumento(c.documentosVisibles[0], 'REJECTED'); fixture.detectChanges();
    expect(register()).toBeUndefined();
  });
});
