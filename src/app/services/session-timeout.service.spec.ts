import { provideHttpClient } from '@angular/common/http';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionTimeoutService } from './session-timeout.service';

describe('SessionTimeoutService', () => {
  const duration = 10 * 60 * 1000;
  const expiryKey = 'kashpay.session.expiresAt';
  let events: Subject<NavigationEnd>;
  let leaf: { data: Record<string, boolean> };
  let service: SessionTimeoutService;
  let auth: AuthService;

  function session(smsValidated: boolean): void {
    localStorage.setItem('auth_session', JSON.stringify({
      success: true, inSession: true, token: 'portal-token', validate: 'guid', smsValidated,
    }));
  }

  function navigate(portal: boolean): void {
    leaf.data = portal ? { sessionTimeout: true } : {};
    events.next(new NavigationEnd(1, '/test', '/test'));
  }

  beforeEach(() => {
    localStorage.clear();
    events = new Subject();
    leaf = { data: {} };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), {
        provide: Router,
        useValue: { events, routerState: { snapshot: { root: { firstChild: leaf } } }, navigate: jasmine.createSpy() },
      }],
    });
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(SessionTimeoutService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('ignora el bearer fijo y una expiración residual sin login', fakeAsync(() => {
    localStorage.setItem('token', 'public-bearer');
    localStorage.setItem(expiryKey, String(Date.now() - 1));
    service.iniciar();
    tick(duration);
    window.dispatchEvent(new Event('focus'));
    expect(service.mostrarModal()).toBeFalse();
    expect(localStorage.getItem(expiryKey)).toBeNull();
  }));

  it('cuenta diez minutos solo después de validar el SMS', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    tick(duration);
    expect(service.mostrarModal()).toBeFalse();
    auth.completeSmsValidation();
    tick(duration - 1);
    expect(service.mostrarModal()).toBeFalse();
    tick(1);
    expect(service.mostrarModal()).toBeTrue();
    expect(auth.hasValidSession()).toBeFalse();
  }));

  it('nunca muestra el aviso en una vista pública aunque exista una sesión vencida', fakeAsync(() => {
    session(true);
    service.iniciar();
    localStorage.setItem(expiryKey, String(Date.now() - 1));
    navigate(false);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    tick(duration);
    expect(service.mostrarModal()).toBeFalse();
    expect(auth.hasValidSession()).toBeTrue();
    navigate(true);
    expect(service.mostrarModal()).toBeTrue();
  }));

  it('cancela el temporizador al salir del portal sin reiniciar el vencimiento', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    const expiresAt = localStorage.getItem(expiryKey);
    tick(duration / 2);
    navigate(false);
    tick(duration / 2);
    expect(service.mostrarModal()).toBeFalse();
    expect(localStorage.getItem(expiryKey)).toBe(expiresAt);
    navigate(true);
    expect(service.mostrarModal()).toBeTrue();
    navigate(false);
    expect(service.mostrarModal()).toBeFalse();
  }));

  it('mantiene el vencimiento al navegar dentro del portal', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration / 2);
    navigate(true);
    tick(duration / 2);
    expect(service.mostrarModal()).toBeTrue();
  }));
});
