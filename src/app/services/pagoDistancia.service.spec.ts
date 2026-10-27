import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PagoDistanciaService } from './pagoDistancia.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('PagoDistanciaService BFF', () => {
  let service: PagoDistanciaService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(PagoDistanciaService);
    http = TestBed.inject(HttpTestingController);
    spyOn(localStorage, 'getItem').and.callFake(key => key === 'entitySonID' ? 'SIRIO-9' : key === 'token' ? 'sesion' : null);
  });
  afterEach(() => http.verify());
  it('consulta el BFF sin enviar el token de proveedor', () => {
    service.buscarOrdenes({ filtro: 'Monto', busqueda: '100', fechaCreacion: '2026-10-24' }).subscribe();
    const request = http.expectOne('/api/pago-distancia/buscar-ordenes');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.body).toEqual({ filtro: 'Monto', busqueda: '100', fechaCreacion: '2026-10-24', sirioID: '' });
    expect(localStorage.getItem).not.toHaveBeenCalled();
    request.flush({ rows: [] });
  });
});
