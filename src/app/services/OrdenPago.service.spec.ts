import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrdenPagoService } from './OrdenPago.service';

describe('OrdenPagoService: contrato BFF', () => {
  let service: OrdenPagoService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrdenPagoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('incluye sesión y encabezado de escritura en todos los POST', () => {
    service.enviarToken().subscribe();
    service.validarToken('123456').subscribe();
    service.agregarContacto({ fullName: 'Ejemplo' }).subscribe();
    service.realizarSpei({ cuentaOr: 'CUENTA' }).subscribe();
    for (const path of ['enviar-token', 'validar-token', 'contactos', 'spei']) {
      const req = http.expectOne(`/api/orden-pago/${path}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.headers.get('X-Portal-Request')).toBe('1');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ success: true });
    }
  });

  for (const balance of [null, '', 'incorrecto', {}, undefined]) {
    it(`reporta saldo inválido en lugar de convertir ${JSON.stringify(balance)} en cero`, () => {
      service.obtenerSaldo('CUENTA').subscribe({ next: () => fail('Saldo inválido aceptado'), error: e => expect(e.message).toContain('saldo no válida') });
      const req = http.expectOne('/api/orden-pago/saldo/CUENTA');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ balance });
    });
  }

  it('conserva cero como un saldo válido', () => {
    service.obtenerSaldo('CUENTA').subscribe(value => expect(value.balance).toBe(0));
    http.expectOne('/api/orden-pago/saldo/CUENTA').flush({ balance: 0 });
  });
});
