import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';

describe('DashboardComponent BFF', () => {
  const service = { getBalanceSirio: () => of({ success: true, virtualAccount: 'cuenta-prueba' }) };
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
  it('solo consulta la cuenta BFF, sin URLs legacy, identificadores ni consultas me propias', () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { getUserData: () => ({ userName: 'Titular' }) } }
    ] });
    const http = TestBed.inject(HttpTestingController);
    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.ngOnInit();
    const requests = http.match(() => true);
    expect(requests.length).toBe(1);
    const request = requests[0];
    expect(request.request.urlWithParams).toBe('/api/account/balance');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, virtualAccount: 'cuenta-prueba' });
    expect(component.virtualAccount()).toBe('cuenta-prueba');
    expect(component.reportes()).toEqual([]);
    expect(component.adquirenciaAvailable).toBeNull();
    http.verify();
  });
});
