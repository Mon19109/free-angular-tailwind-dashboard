import { AuthGuard } from '../guards/auth.guard';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authTokenInterceptor } from './auth-token.interceptor';
import { sessionExpirationInterceptor } from './session-expiration.interceptor';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
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
      success: true, inSession: true, token: 'portal-token', refreshToken: 'refresh-original', validate: 'guid', smsValidated,
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


  it('mantiene el popup al vencer y navega al login solo al aceptar', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration);
    const router = TestBed.inject(Router);
    expect(service.mostrarModal()).toBeTrue();
    expect(auth.hasValidSession()).toBeFalse();
    expect(TestBed.inject(AuthGuard).canActivate()).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.mostrarModal()).toBeTrue();
    window.dispatchEvent(new Event('focus'));
    expect(service.mostrarModal()).toBeTrue();
    service.aceptarCierreSesion();
    expect(service.mostrarModal()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/']);
  }));

  it('interrumpe la navegación y muestra el aviso si el tiempo venció con la pestaña suspendida', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    spyOn(Date, 'now').and.returnValue(Number(localStorage.getItem(expiryKey)) + 1);
    expect(TestBed.inject(AuthGuard).canActivate()).toBeFalse();
    expect(service.mostrarModal()).toBeTrue();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  }));

  it('mantiene el aviso cuando el guard encuentra una sesión vencida antes de iniciar el servicio', fakeAsync(() => {
    session(false);
    auth.completeSmsValidation();
    spyOn(Date, 'now').and.returnValue(Number(localStorage.getItem(expiryKey)) + 1);
    expect(TestBed.inject(AuthGuard).canActivate()).toBeFalse();
    service.iniciar();
    expect(service.mostrarModal()).toBeTrue();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  }));

  it('redirige normalmente al login cuando nunca hubo sesión', () => {
    expect(TestBed.inject(AuthGuard).canActivate()).toBeFalse();
    expect(service.mostrarModal()).toBeFalse();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledOnceWith(['/']);
  });


  it('muestra la cuenta regresiva en los últimos diez segundos y luego el cierre', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration - 10001);
    expect(service.mostrarAviso()).toBeFalse();
    tick(1);
    expect(service.mostrarAviso()).toBeTrue();
    expect(service.segundosRestantes()).toBe(10);
    tick(9000);
    expect(service.segundosRestantes()).toBe(1);
    expect(service.mostrarModal()).toBeFalse();
    tick(1000);
    expect(service.mostrarAviso()).toBeFalse();
    expect(service.mostrarModal()).toBeTrue();
  }));

  it('renueva solo al confirmar, guarda los tokens y repite el ciclo', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration - 10000);
    const http = TestBed.inject(HttpTestingController);
    http.expectNone('/OAuthServices/v2/oauth/refresh');
    service.mantenerSesion();
    service.mantenerSesion();
    const request = http.expectOne('/OAuthServices/v2/oauth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Authorization')).toBe('Bearer refresh-original');
    request.flush({ success: true, authResponse: { accessToken: 'token-nuevo', refreshToken: 'refresh-nuevo' } });
    expect(auth.getToken()).toBe('token-nuevo');
    expect(auth.getRefreshToken()).toBe('refresh-nuevo');
    expect(localStorage.getItem('token')).toBe('token-nuevo');
    expect(localStorage.getItem('auth_token')).toBe('token-nuevo');
    expect(service.mostrarAviso()).toBeFalse();
    expect(Number(localStorage.getItem(expiryKey))).toBe(Date.now() + duration);

    tick(duration - 10000);
    expect(service.mostrarAviso()).toBeTrue();
    expect(service.segundosRestantes()).toBe(10);
    service.mantenerSesion();
    const segunda = http.expectOne('/OAuthServices/v2/oauth/refresh');
    expect(segunda.request.headers.get('Authorization')).toBe('Bearer refresh-nuevo');
    segunda.flush({ success: true, authResponse: { accessToken: 'token-tercero', refreshToken: 'refresh-tercero' } });
    TestBed.inject(HttpClient).get('/api/privada', { headers: { Authorization: 'Bearer portal-token' } }).subscribe();
    const privada = http.expectOne('/api/privada');
    expect(privada.request.headers.get('Authorization')).toBe('Bearer token-tercero');
    privada.flush({});
    TestBed.inject(HttpClient).get('/api/publica', { headers: { Authorization: 'Bearer fijo' } }).subscribe();
    const publica = http.expectOne('/api/publica');
    expect(publica.request.headers.get('Authorization')).toBe('Bearer fijo');
    publica.flush({});
    tick(duration);
    expect(service.mostrarModal()).toBeTrue();
    http.verify();
  }));

  it('no extiende el plazo cuando falla la renovación', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    const expiresAt = localStorage.getItem(expiryKey);
    tick(duration - 10000);
    service.mantenerSesion();
    TestBed.inject(HttpTestingController).expectOne('/OAuthServices/v2/oauth/refresh')
      .flush({ success: false, error: { message: 'Refresh inválido' } });
    expect(service.errorRenovacion()).toBe('Refresh inválido');
    expect(localStorage.getItem(expiryKey)).toBe(expiresAt);
    tick(10000);
    expect(service.mostrarModal()).toBeTrue();
    expect(auth.hasValidSession()).toBeFalse();
  }));

  it('cancela una renovación pendiente al vencer para no reactivar la sesión', fakeAsync(() => {
    session(false);
    navigate(true);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration - 1000);
    service.mantenerSesion();
    const request = TestBed.inject(HttpTestingController).expectOne('/OAuthServices/v2/oauth/refresh');
    tick(1000);
    expect(request.cancelled).toBeTrue();
    expect(service.mostrarModal()).toBeTrue();
    expect(auth.hasValidSession()).toBeFalse();
  }));

  it('no muestra la advertencia ni renueva en vistas públicas', fakeAsync(() => {
    session(false);
    service.iniciar();
    auth.completeSmsValidation();
    tick(duration - 10000);
    expect(service.mostrarAviso()).toBeFalse();
    service.mantenerSesion();
    TestBed.inject(HttpTestingController).expectNone('/OAuthServices/v2/oauth/refresh');
    tick(10000);
    expect(service.mostrarModal()).toBeFalse();
    expect(auth.hasValidSession()).toBeFalse();
  }));

  it('guarda el refreshToken de authenticate antes de completar el SMS', () => {
    spyOn(auth, 'getBalance').and.returnValue(of({}));
    auth['processLoginResponse']({ terminalInfo: { phoneNumber: '5512345678', guid: 'guid' } },
      { authResponse: { accessToken: 'access-login', refreshToken: 'refresh-login' } },
      'usuario@example.com', '0', '0').subscribe();
    expect(auth.getUserData().refreshToken).toBe('refresh-login');
    expect(auth.getRefreshToken()).toBeNull();
    auth.completeSmsValidation();
    expect(auth.getRefreshToken()).toBe('refresh-login');
  });

});
