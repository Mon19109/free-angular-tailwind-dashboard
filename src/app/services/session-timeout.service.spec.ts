import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionTimeoutService } from './session-timeout.service';
import { authTokenInterceptor } from './auth-token.interceptor';
import { sessionExpirationInterceptor } from './session-expiration.interceptor';

describe('SessionTimeoutService con sesión BFF', () => {
  let service: SessionTimeoutService; let auth: AuthService; let http: HttpTestingController;
  let events: Subject<NavigationEnd>; let leaf: { data: Record<string, boolean> };
  const duration = 600000;
  const active = () => ({ success: true, authenticated: true, expiresAt: Date.now() + duration, usuario: { idRol: 2 } });
  beforeEach(() => {
    events = new Subject(); leaf = { data: { sessionTimeout: true } };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authTokenInterceptor, sessionExpirationInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: { events, routerState: { snapshot: { root: { firstChild: leaf } } }, navigate: jasmine.createSpy() } }
    ] });
    auth = TestBed.inject(AuthService); service = TestBed.inject(SessionTimeoutService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });
  function iniciar(authenticated = true): void {
    service.iniciar(); http.expectOne('/api/auth/me').flush(authenticated ? active() : { success: false, authenticated: false });
  }
  function publica(): void { leaf.data = {}; events.next(new NavigationEnd(1, '/preregistro', '/preregistro')); }
  it('muestra aviso y modal al alcanzar el vencimiento sin tokens locales', fakeAsync(() => {
    iniciar(); tick(duration - 20000); expect(service.mostrarAviso()).toBeTrue();
    expect(service.segundosRestantes()).toBe(20); tick(20000);
    expect(service.mostrarModal()).toBeTrue(); expect(auth.hasValidSession()).toBeFalse();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    service.aceptarCierreSesion(); expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/']);
  }));
  it('no autentica ni inicia cuenta regresiva mientras SMS está pendiente', fakeAsync(() => {
    iniciar(false); tick(duration); expect(service.mostrarModal()).toBeFalse();
  }));
  it('no consulta autenticación ni bloquea el prerregistro público', fakeAsync(() => {
    publica(); service.iniciar(); http.expectNone('/api/auth/me'); tick(duration);
    expect(service.mostrarModal()).toBeFalse();
  }));
  it('vence sin modal al navegar al prerregistro', fakeAsync(() => {
    iniciar(); publica(); tick(duration); expect(service.mostrarModal()).toBeFalse(); expect(auth.hasValidSession()).toBeFalse();
  }));
  it('comprueba el tiempo al reactivar una pestaña suspendida', fakeAsync(() => {
    iniciar(); spyOn(Date, 'now').and.returnValue(auth.getSessionExpiry() + 1);
    window.dispatchEvent(new Event('focus')); expect(service.mostrarModal()).toBeTrue();
  }));
  it('renueva una sola petición sin tokens y usa la nueva expiración del BFF', fakeAsync(() => {
    iniciar(); tick(duration - 20000); service.mantenerSesion(); service.mantenerSesion();
    const req = http.expectOne('/api/auth/refresh'); expect(req.request.body).toEqual({});
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('X-Portal-Request')).toBe('1'); req.flush(active());
    expect(service.mostrarAviso()).toBeFalse(); tick(duration - 1); expect(auth.hasValidSession()).toBeTrue();
    tick(1); expect(service.mostrarModal()).toBeTrue();
  }));
  it('un error temporal de refresh no extiende el plazo', fakeAsync(() => {
    iniciar(); const expiry = auth.getSessionExpiry(); tick(duration - 20000); service.mantenerSesion();
    http.expectOne('/api/auth/refresh').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.getSessionExpiry()).toBe(expiry); expect(service.errorRenovacion()).not.toBe('');
    tick(20000); expect(service.mostrarModal()).toBeTrue();
  }));
  it('un 401 privado invalida la sesión y muestra el modal', fakeAsync(() => {
    iniciar(); TestBed.inject(HttpClient).get('/api/account/balance').subscribe({ error: () => undefined });
    http.expectOne('/api/account/balance').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.mostrarModal()).toBeTrue(); expect(auth.hasValidSession()).toBeFalse();
  }));
  it('un SMS incorrecto no abre el modal de sesión vencida', fakeAsync(() => {
    iniciar(false); auth.validateSmsToken('123').subscribe({ error: () => undefined });
    http.expectOne('/api/auth/verify-sms').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.mostrarModal()).toBeFalse();
  }));
  it('cancela el refresh pendiente al expirar', fakeAsync(() => {
    iniciar(); tick(duration - 1000); service.mantenerSesion(); const req = http.expectOne('/api/auth/refresh');
    tick(1000); expect(req.cancelled).toBeTrue(); expect(service.mostrarModal()).toBeTrue();
  }));
  it('logout confirma el cierre servidor antes de navegar', fakeAsync(() => {
    iniciar(); service.cerrarSesion(); expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    http.expectOne('/api/auth/logout').flush({ success: true });
    expect(auth.hasValidSession()).toBeFalse(); expect(service.mostrarModal()).toBeFalse();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/']);
  }));
});
