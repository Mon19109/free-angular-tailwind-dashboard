import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authTokenInterceptor } from './auth-token.interceptor';
import { sessionExpirationInterceptor } from './session-expiration.interceptor';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
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
      providers: [provideHttpClient(withInterceptors([authTokenInterceptor, sessionExpirationInterceptor])), provideHttpClientTesting(), {
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
    expect(auth.hasValidSession()).toBeFalse();
    navigate(true);
    expect(service.mostrarModal()).toBeFalse();
  }));

  it('vence también fuera del portal sin mostrar el aviso', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    const expiresAt = localStorage.getItem(expiryKey);
    tick(duration / 2);
    navigate(false);
    expect(localStorage.getItem(expiryKey)).toBe(expiresAt);
    tick(duration / 2);
    expect(service.mostrarModal()).toBeFalse();
    expect(auth.hasValidSession()).toBeFalse();
    expect(localStorage.getItem(expiryKey)).toBeNull();
    navigate(true);
    expect(service.mostrarModal()).toBeFalse();
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

  it('cierra al recuperar foco aunque el navegador haya pospuesto el temporizador', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    const expiresAt = Number(localStorage.getItem(expiryKey));
    spyOn(Date, 'now').and.returnValue(expiresAt + 1);
    window.dispatchEvent(new Event('focus'));
    expect(auth.hasValidSession()).toBeFalse();
    expect(service.mostrarModal()).toBeTrue();
  }));

  for (const authorization of [undefined, 'Bearer portal-token']) {
    it(`bloquea peticiones vencidas antes de enviarlas con bearer ${authorization ? 'explícito' : 'automático'}`, fakeAsync(() => {
      session(false);
      navigate(true);
      service.iniciar();
      auth.completeSmsValidation();
      spyOn(Date, 'now').and.returnValue(Number(localStorage.getItem(expiryKey)));
      let error: HttpErrorResponse | undefined;
      TestBed.inject(HttpClient).get('/api/privada', {
        headers: authorization ? { Authorization: authorization } : {},
      }).subscribe({ error: value => error = value });
      TestBed.inject(HttpTestingController).expectNone('/api/privada');
      expect(error?.error.code).toBe('SESSION_EXPIRED');
      expect(auth.hasValidSession()).toBeFalse();
      expect(service.mostrarModal()).toBeTrue();
    }));
  }

  it('conserva las peticiones públicas con bearer fijo al vencer la sesión', fakeAsync(() => {
    session(false);
    service.iniciar();
    auth.completeSmsValidation();
    spyOn(Date, 'now').and.returnValue(Number(localStorage.getItem(expiryKey)));
    TestBed.inject(HttpClient).get('/api/publica', {
      headers: { Authorization: 'Bearer public-token' },
    }).subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/publica').flush({ success: true });
    expect(auth.hasValidSession()).toBeFalse();
    expect(service.mostrarModal()).toBeFalse();
  }));

  it('conserva la fecha al restaurar una sesión y al repetir la confirmación SMS', fakeAsync(() => {
    session(false);
    auth.completeSmsValidation();
    const expiresAt = localStorage.getItem(expiryKey);
    tick(duration / 2);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    expect(localStorage.getItem(expiryKey)).toBe(expiresAt);
    tick(duration / 2);
    expect(service.mostrarModal()).toBeTrue();
  }));

});
