import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('should be created', () => expect(service).toBeTruthy());
  it('consulta la cuenta mediante cookie y ruta relativa, sin credenciales ni IDs', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('No leer almacenamiento');
    service.getBalanceSirio().subscribe(value => expect(value).toEqual({ success: true, virtualAccount: 'cuenta-prueba', balance: 123, customerNetworkBalance: null }));
    const request = http.expectOne('/api/account/balance');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ success: true, virtualAccount: 'cuenta-prueba', balance: 123, terminalInfo: {} });
  });
  it('no convierte una cuenta ausente en saldo cero', () => {
    service.getBalanceSirio().subscribe(value => expect(value.virtualAccount).toBeNull());
    http.expectOne('/api/account/balance').flush({ success: true, virtualAccount: null });
  });
  it('rechaza respuestas fallidas sin ocultar el error', () => {
    service.getBalanceSirio().subscribe({ next: () => fail('Respuesta inválida'), error: e => expect(e).toBeTruthy() });
    http.expectOne('/api/account/balance').flush({ success: false });
  });
  it('propaga expiración para el interceptor de sesión', () => {
    service.getBalanceSirio().subscribe({ next: () => fail('Sin sesión'), error: e => expect(e.status).toBe(401) });
    http.expectOne('/api/account/balance').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
  it('consulta solo endpoints BFF con cookie, sin IDs ni almacenamiento', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('No leer almacenamiento');
    for (const [query, path] of [
      [() => service.getBalanceAhorro(), '/api/account/reserva'],
      [() => service.getBalanceAldebaran(), '/api/account/emision']
    ] as const) {
      query().subscribe({ next: () => fail('Contrato pendiente'), error: e => expect(e.status).toBe(503) });
      const request = http.expectOne(path);
      expect(request.request.withCredentials).toBeTrue();
      expect(request.request.headers.has('Authorization')).toBeFalse();
      expect(request.request.params.keys()).toEqual([]);
      request.flush({ success: false, code: 'BALANCE_CONTRACT_PENDING', balance: null }, { status: 503, statusText: 'Unavailable' });
    }
  });
  it('solo conserva capacidades booleanas y columnas explícitas del reporte', () => {
    service.getCapabilities().subscribe(value => expect(value).toEqual({ success: true, emision: false, adquirencia: true, reserva: false }));
    http.expectOne('/api/account/capabilities').flush({ success: true, emision: false, adquirencia: true, reserva: false, reserveId: 'private' });
    service.getReport().subscribe(value => expect(value.rows).toEqual([{ brandName: 'VISA', numTrs: 0, totalCost: null, totalFee: 1,
      totalFeeTax: null, totalAmount: 10, totalNetAmount: 9 }]));
    const request = http.expectOne('/api/account/report');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ success: true, rows: [{ brandName: 'VISA', numTrs: 0, totalFee: 1, totalAmount: 10, totalNetAmount: 9, privateId: 99 }] });
  });
  it('no convierte contratos inválidos o vacíos en resultados válidos', () => {
    for (const body of [null, {}, { success: true }, { success: true, rows: [{}] }]) {
      service.getReport().subscribe({ next: () => fail('Reporte inválido'), error: e => expect(e).toBeTruthy() });
      http.expectOne('/api/account/report').flush(body);
    }
    service.getCapabilities().subscribe({ next: () => fail('Capacidades inválidas'), error: e => expect(e).toBeTruthy() });
    http.expectOne('/api/account/capabilities').flush({ success: true, emision: 1, adquirencia: true, reserva: false });
  });
  it('rechaza un cuerpo vacío sin producir saldo o cuenta simulados', () => {
    service.getBalanceSirio().subscribe({
      next: () => fail('El cuerpo vacío no cumple el contrato BFF'),
      error: error => expect(error.message).toBe('Respuesta de cuenta no válida')
    });
    http.expectOne('/api/account/balance').flush(null);
  });
  it('propaga errores del backend sin convertirlos en resultados vacíos', () => {
    service.getBalanceSirio().subscribe({
      next: () => fail('El backend no respondió correctamente'),
      error: error => expect(error.status).toBe(502)
    });
    http.expectOne('/api/account/balance').flush({ success: false }, {
      status: 502, statusText: 'Bad Gateway'
    });
  });

  it('conserva importes decimales, cero y null sin sustituirlos', () => {
    for (const balances of [
      { balance: 1500.50, customerNetworkBalance: 250.75 },
      { balance: 0, customerNetworkBalance: null },
      { balance: null, customerNetworkBalance: 0 }
    ]) {
      service.getBalanceSirio().subscribe(value => {
        expect(value.balance).toBe(balances.balance);
        expect(value.customerNetworkBalance).toBe(balances.customerNetworkBalance);
      });
      http.expectOne('/api/account/balance').flush({ success: true, virtualAccount: null, ...balances });
    }
  });
  it('trata los importes ausentes como no disponibles', () => {
    service.getBalanceSirio().subscribe(value => {
      expect(value.balance).toBeNull();
      expect(value.customerNetworkBalance).toBeNull();
    });
    http.expectOne('/api/account/balance').flush({ success: true, virtualAccount: null });
  });
  it('rechaza importes string o booleanos en cualquiera de los campos', () => {
    for (const fields of [{ balance: '1500.50' }, { customerNetworkBalance: false }]) {
      service.getBalanceSirio().subscribe({
        next: () => fail('Tipo de importe inválido'),
        error: error => expect(error.message).toBe('Respuesta de saldo no válida')
      });
      http.expectOne('/api/account/balance').flush({ success: true, virtualAccount: null, ...fields });
    }
  });

});
