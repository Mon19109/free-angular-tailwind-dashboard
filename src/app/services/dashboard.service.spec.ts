import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService, DashboardContractPendingError } from './dashboard.service';

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
    service.getBalanceSirio().subscribe(value => expect(value).toEqual({ success: true, virtualAccount: 'cuenta-prueba' }));
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
  it('marca contratos pendientes sin consultar APIs originales ni sustituir cuentas', () => {
    for (const request of [service.getBalanceAhorro(), service.getBalanceAldebaran(), service.getReport()]) {
      request.subscribe({ next: () => fail('Sin contrato'), error: e => expect(e instanceof DashboardContractPendingError).toBeTrue() });
    }
    http.expectNone(() => true);
  });
});
