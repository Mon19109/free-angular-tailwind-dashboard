import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AccountBalanceResponse, DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';

describe('DashboardComponent BFF', () => {
  const service = {
    getCapabilities: () => of({ success: true, emision: false, adquirencia: true, reserva: false }),
    getReport: () => of({ success: true, rows: [] }),
    getBalanceSirio: (): Observable<AccountBalanceResponse> => of({ success: true, virtualAccount: 'cuenta-prueba', balance: null, customerNetworkBalance: null }) };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: DashboardService, useValue: service },
      { provide: AuthService, useValue: { getUserData: () => ({ userName: 'Titular' }) } }
    ] });
  });
  it('muestra la cuenta sin interpretar su número como importe', () => {
    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.ngOnInit();
    expect(component.virtualAccount()).toBe('cuenta-prueba');
    expect(component.userName).toBe('Titular');
    expect(component.adquirenciaAvailable).toBeNull();
    expect(component.money(null)).toBe('No disponible');
    expect(component.money(0)).toContain('0.00');
    expect(component.money('123')).toBe('No disponible');
  });
  it('señala errores y descarta una cuenta anterior', () => {
    spyOn(service, 'getBalanceSirio').and.returnValue(throwError(() => new Error('fallo')));
    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.virtualAccount.set('anterior');
    component.ngOnInit();
    expect(component.accountState()).toBe('error');
    expect(component.virtualAccount()).toBeNull();
  });
});


describe('Peticiones al entrar al dashboard', () => {
  it('consulta capacidades, cuenta y reporte BFF sin URLs legacy ni identificadores', () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { getUserData: () => ({ userName: 'Titular' }) } }
    ] });
    const http = TestBed.inject(HttpTestingController);
    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.ngOnInit();
    const capabilities = http.expectOne('/api/account/capabilities');
    expect(capabilities.request.withCredentials).toBeTrue();
    capabilities.flush({ success: true, emision: false, adquirencia: true, reserva: false });
    const report = http.expectOne('/api/account/report');
    expect(report.request.withCredentials).toBeTrue();
    report.flush({ success: true, rows: [] });
    const requests = http.match(() => true);
    expect(requests.length).toBe(1);
    const request = requests[0];
    expect(request.request.urlWithParams).toBe('/api/account/balance');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, virtualAccount: 'cuenta-prueba', balance: 1500.50, customerNetworkBalance: 250.75 });
    expect(component.virtualAccount()).toBe('cuenta-prueba');
    expect(component.reportes()).toEqual([]);
    expect(component.adquirenciaAvailable).toBe(1500.50);
    expect(component.adquirenciaPending).toBe(250.75);
    http.verify();
  });
});


describe('Tarjetas Adquirencia', () => {
  it('renderiza carga, importes MXN, cero, null y error sin conservar saldos anteriores', () => {
    let reply = new Subject<AccountBalanceResponse>();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardService, useValue: { getBalanceSirio: () => reply,
          getCapabilities: () => of({ success: true, emision: false, adquirencia: true, reserva: false }),
          getReport: () => of({ success: true, rows: [] }) } },
        { provide: AuthService, useValue: { getUserData: () => ({ userName: 'Titular' }) } }
      ]
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.mostrarModalImagen = false;
    fixture.detectChanges();
    const amounts = () => Array.from(fixture.nativeElement.querySelectorAll('.balance-option strong'))
      .map(element => (element as HTMLElement).textContent?.trim());
    expect(amounts()).toEqual(['Cargando…', 'Cargando…']);
    reply.next({ success: true, virtualAccount: 'cuenta-prueba', balance: 1500.50, customerNetworkBalance: 250.75 });
    fixture.detectChanges();
    expect(amounts()).toEqual([component.money(1500.50), component.money(250.75)]);
    expect(amounts()[0]).toContain('1,500.50');
    reply.next({ success: true, virtualAccount: null, balance: 0, customerNetworkBalance: null });
    reply.complete();
    fixture.detectChanges();
    expect(amounts()).toEqual([component.money(0), 'No disponible']);
    expect(amounts()[0]).toContain('0.00');
    reply = new Subject<AccountBalanceResponse>();
    component.cargarDatosIniciales();
    fixture.detectChanges();
    expect(component.adquirenciaAvailable).toBeNull();
    expect(amounts()).toEqual(['Cargando…', 'Cargando…']);
    reply.error(new Error('fallo de consulta'));
    fixture.detectChanges();
    expect(amounts()).toEqual(['No disponible', 'No disponible']);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.destroy();
  });
});


describe('Dashboard capacidades y contratos pendientes', () => {
  it('respeta capacidades, no duplica Adquirencia y distingue reporte vacío de error', () => {
    const pending = () => throwError(() => ({ status: 503, error: { code: 'BALANCE_CONTRACT_PENDING' } }));
    const service = {
      getCapabilities: () => of({ success: true, emision: true, adquirencia: true, reserva: true }),
      getBalanceSirio: () => of({ success: true, virtualAccount: null, balance: 1000, customerNetworkBalance: 200 }),
      getBalanceAhorro: jasmine.createSpy().and.callFake(pending),
      getBalanceAldebaran: jasmine.createSpy().and.callFake(pending),
      getReport: () => of({ success: true, rows: [] })
    };
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [
      { provide: DashboardService, useValue: service },
      { provide: AuthService, useValue: { getUserData: () => ({ userName: 'Titular' }) } }
    ] });
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.mostrarModalImagen = false;
    fixture.detectChanges();
    expect(component.adquirenciaAvailable).toBe(1000);
    expect(component.emisionBalance()).toBeNull();
    expect(component.balanceAhorro()).toEqual([]);
    expect(component.emisionState()).toBe('unavailable');
    expect(component.reservaState()).toBe('unavailable');
    expect(fixture.nativeElement.querySelector('.reserve-card').textContent).toContain('No disponible');
    expect(fixture.nativeElement.querySelector('.emision-card').textContent).not.toContain('0.00');
    expect(component.pendingMessage).toBe('No hay elementos disponibles.');
    spyOn(service, 'getReport').and.returnValue(throwError(() => new Error('failed')));
    component.cargarDatosIniciales();
    expect(component.pendingMessage).toBe('No fue posible consultar el reporte.');
    spyOn(service, 'getCapabilities').and.returnValue(of({ success: true, emision: false, adquirencia: true, reserva: false }));
    service.getBalanceAhorro.calls.reset(); service.getBalanceAldebaran.calls.reset();
    component.cargarDatosIniciales(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reserve-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.emision-card')).toBeNull();
    expect(service.getBalanceAhorro).not.toHaveBeenCalled();
    expect(service.getBalanceAldebaran).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('no consulta cuentas cuando las capacidades fallan', () => {
    const getBalanceSirio = jasmine.createSpy();
    TestBed.configureTestingModule({ providers: [
      { provide: DashboardService, useValue: { getCapabilities: () => throwError(() => new Error('failed')), getBalanceSirio } },
      { provide: AuthService, useValue: { getUserData: () => ({}) } }
    ] });
    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.ngOnInit();
    expect(component.showEmision).toBeFalse(); expect(component.showReserve).toBeFalse();
    expect(component.capabilitiesState()).toBe('error');
    expect(getBalanceSirio).not.toHaveBeenCalled();
  });
});
