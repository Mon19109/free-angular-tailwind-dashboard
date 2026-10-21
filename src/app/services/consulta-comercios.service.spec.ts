import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ConsultaComerciosService } from './consulta-comercios.service';
import { authTokenInterceptor } from '../guards/auth-token.interceptor';

describe('Consulta de comercios BFF', () => {
  let http: HttpTestingController;
  let service: ConsultaComerciosService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConsultaComerciosService);
  });
  afterEach(() => http.verify());
  it('envía exclusivamente filtros con cookie y protección CSRF, sin leer storage', () => {
    const storage = spyOn(localStorage, 'getItem').and.throwError('Storage prohibido');
    service.buscarComercios({ nameCommerce: 'Tienda', rfc: 'RFC', email: 'fixture@example.invalid', telefono: '123', status: 'ACTIVO', nodeID: 'private', token: 'private' } as any).subscribe();
    const req = http.expectOne('/api/comercios/buscar');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-Portal-Request')).toBe('1');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.body).toEqual({ nameCommerce: 'Tienda', rfc: 'RFC', email: 'fixture@example.invalid', telefono: '123', status: 'ACTIVO' });
    req.flush({ success: true, commerces: [] });
    expect(storage).not.toHaveBeenCalled();
  });
  it('propaga errores sin consultar otro endpoint', () => {
    let status = 0;
    service.buscarComercios({}).subscribe({ error: error => status = error.status });
    http.expectOne('/api/comercios/buscar').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    http.expectNone(request => request.url !== '/api/comercios/buscar');
  });
});
