import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environments';
import { authTokenInterceptor } from './auth-token.interceptor';
import { SeguimientoProspectoService } from './seguimiento-prospecto.service';

describe('SeguimientoProspectoService', () => {
  it('omite Authorization aunque exista un token de sesión y conserva autenticación en otras solicitudes', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()]
    });
    spyOn(localStorage, 'getItem').and.callFake(key => key === 'token' ? 'token-de-sesion' : null);
    const http = TestBed.inject(HttpTestingController);
    let completado = false;
    TestBed.inject(SeguimientoProspectoService).completar('token_seguimiento-123').subscribe(() => completado = true);
    const request = http.expectOne(`${environment.api.KashpayCoreAPI}prospect/follow_up_link`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ url: 'token_seguimiento-123', statusDescription: 'COMPLETED' });
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(null);
    expect(completado).toBeTrue();
    TestBed.inject(HttpClient).get('/otra-consulta').subscribe();
    const otraConsulta = http.expectOne('/otra-consulta');
    expect(otraConsulta.request.headers.get('Authorization')).toBe('Bearer token-de-sesion');
    otraConsulta.flush({});
    http.verify();
  });
});
