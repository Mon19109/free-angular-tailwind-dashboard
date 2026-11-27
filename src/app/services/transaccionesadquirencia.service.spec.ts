import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransaccionesAdquirenciaService } from './transaccionesadquirencia.service';

describe('Transacciones Adquirencia: sesion del servidor', () => {
  let service: TransaccionesAdquirenciaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TransaccionesAdquirenciaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  for (const [method, path] of [
    ['getEntidades', 'entidades'], ['getSucursales', 'sucursales'], ['getCajas', 'cajas']
  ] as const) {
    it(`${path}: permite que el BFF tome el nodo de sesion`, () => {
      service[method]().subscribe();
      const req = http.expectOne(`/api/transacciones-adquirencia/${path}`);
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.headers.get('X-Portal-Request')).toBe('1');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush([]);
    });

    it(`${path}: conserva un nodo seleccionado explicitamente`, () => {
      service[method]('nodo/seleccionado').subscribe();
      http.expectOne(`/api/transacciones-adquirencia/${path}/nodo%2Fseleccionado`).flush([]);
    });
  }
});
