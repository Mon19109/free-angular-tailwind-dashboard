import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authTokenInterceptor } from './auth-token.interceptor';
import { SeguimientoProspectoService } from './seguimiento-prospecto.service';

describe('SeguimientoProspectoService (BFF)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()]
    });
    spyOn(localStorage, 'getItem').and.callFake(key => key === 'token' ? 'token-de-sesion' : null);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('envía PUT al BFF sin token del navegador y no afecta otras peticiones', () => {
    let completado = false;
    TestBed.inject(SeguimientoProspectoService).completar('token_seguimiento-123').subscribe(() => completado = true);
    const req = http.expectOne('/api/seguimiento-prospecto/completar');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ url: 'token_seguimiento-123', statusDescription: 'COMPLETED' });
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.has('versionApp')).toBeFalse();
    req.flush(null);
    expect(completado).toBeTrue();
    TestBed.inject(HttpClient).get('/otra-consulta').subscribe();
    const otra = http.expectOne('/otra-consulta');
    expect(otra.request.headers.get('Authorization')).toBe('Bearer token-de-sesion');
    otra.flush({});
  });

  it('propaga el error de negocio existente', () => {
    let mensaje = '';
    TestBed.inject(SeguimientoProspectoService).completar('token_seguimiento-123').subscribe({
      error: (error: Error) => mensaje = error.message
    });
    http.expectOne('/api/seguimiento-prospecto/completar')
      .flush({ success: false, message: 'Seguimiento no encontrado' });
    expect(mensaje).toBe('Seguimiento no encontrado');
  });
});
