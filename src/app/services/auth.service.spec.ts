import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('AuthService con BFF', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const active = () => ({ success: true, authenticated: true, expiresAt: Date.now() + 600000, usuario: { idRol: 2, mail: 'operador@example.test' } });
  beforeEach(() => {
    localStorage.setItem('auth_session', 'credencial-legacy');
    localStorage.setItem('preregistro.draft', 'conservar');
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); localStorage.removeItem('preregistro.draft'); });
  it('elimina credenciales legacy sin borrar el prerregistro', () => {
    expect(localStorage.getItem('auth_session')).toBeNull();
    expect(localStorage.getItem('preregistro.draft')).toBe('conservar');
  });
  it('login no autentica hasta recibir confirmación SMS del servidor', () => {
    auth.searchAccount('a@example.test', 'contraseña-prueba', '1', '2').subscribe();
    const login = http.expectOne('/api/auth/login');
    expect(login.request.method).toBe('POST');
    expect(login.request.headers.get('X-Portal-Request')).toBe('1');
    expect(login.request.headers.has('Authorization')).toBeFalse();
    expect(login.request.withCredentials).toBeTrue();
    login.flush({ success: true, os: 1, oft: '12' });
    expect(auth.hasValidSession()).toBeFalse();
    auth.completeSmsValidation();
    expect(auth.hasValidSession()).toBeFalse();
    auth.validateSmsToken('123456').subscribe();
    const sms = http.expectOne('/api/auth/verify-sms');
    expect(sms.request.body).toEqual({ tokenSms: '123456' });
    sms.flush(active());
    expect(auth.hasValidSession()).toBeTrue();
    expect(auth.getToken()).toBeNull(); expect(auth.getRefreshToken()).toBeNull();
    expect(localStorage.getItem('auth_session')).toBeNull();
  });
  it('no autentica con success sin authenticated ni con SMS rechazado', () => {
    auth.validateSmsToken('123').subscribe();
    http.expectOne('/api/auth/verify-sms').flush({ success: true });
    expect(auth.hasValidSession()).toBeFalse();
    auth.validateSmsToken('123').subscribe({ error: () => undefined });
    http.expectOne('/api/auth/verify-sms').flush({ success: false }, { status: 400, statusText: 'Invalid' });
    expect(auth.hasValidSession()).toBeFalse();
  });
  it('restaura /me en memoria y descarta campos ajenos al contrato', () => {
    auth.validarSesion().subscribe(); auth.validarSesion().subscribe();
    http.expectOne('/api/auth/me').flush({ ...active(), accessToken: 'no-conservar', usuario: { ...active().usuario, refreshToken: 'no-conservar' } });
    expect(auth.hasValidSession()).toBeTrue();
    expect(auth.getUserData().refreshToken).toBeUndefined();
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('rechaza sesiones vencidas y errores de /me', () => {
    auth.validarSesion().subscribe();
    http.expectOne('/api/auth/me').flush({ ...active(), expiresAt: Date.now() - 1 });
    expect(auth.hasValidSession()).toBeFalse();
    auth.validarSesion().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.hasValidSession()).toBeFalse();
  });
  it('una respuesta /me anterior al logout no reactiva la sesión', () => {
    auth.actualizarSesion(active());
    auth.validarSesion().subscribe(); const me = http.expectOne('/api/auth/me');
    auth.logout().subscribe(); http.expectOne('/api/auth/logout').flush({ success: true });
    me.flush(active()); expect(auth.hasValidSession()).toBeFalse();
  });
  it('no afirma cerrar la sesión servidor si logout falla', () => {
    auth.actualizarSesion(active()); let failed = false;
    auth.logout().subscribe({ error: () => failed = true });
    http.expectOne('/api/auth/logout').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toBeTrue();
  });
  it('el interceptor retira Authorization en BFF y no altera prerregistro ni terceros', () => {
    const client = TestBed.inject(HttpClient);
    client.put('/api/auth/update-password', {}, { headers: { Authorization: 'Bearer prueba' } }).subscribe();
    const req = http.expectOne('/api/auth/update-password');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('X-Portal-Request')).toBe('1'); req.flush({ success: true });
    for (const url of ['/preregistro/registro-completo', 'https://example.test/endpoint']) {
      client.post(url, {}).subscribe(); const publicReq = http.expectOne(url);
      expect(publicReq.request.headers.has('X-Portal-Request')).toBeFalse();
      expect(publicReq.request.withCredentials).toBeFalse(); publicReq.flush({});
    }
  });
});
