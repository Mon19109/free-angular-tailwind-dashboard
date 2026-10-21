import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError, map, finalize, shareReplay, defer } from 'rxjs';

export interface PortalSession {
  success: boolean;
  authenticated: boolean;
  expiresAt?: number;
  usuario?: Record<string, any> & { idRol?: number };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStatusSubject = new BehaviorSubject<boolean>(false);
  readonly authStatus$ = this.authStatusSubject.asObservable();
  private session: PortalSession | null = null;
  private version = 0;
  private consulta?: Observable<PortalSession>;
  movilEncrip = '';

  constructor() {
    // Retirar credenciales de instalaciones anteriores sin leerlas ni borrar prerregistro.
    for (const key of ['auth_session', 'user_data', 'token', 'auth_token', 'accessToken', 'refreshToken', 'kashpay.session.expiresAt']) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }
  obtenerIp(): Observable<string> { return of(''); }
  hasValidSession(): boolean { return this.session?.authenticated === true && (this.session.expiresAt ?? 0) > Date.now(); }
  getSessionExpiry(): number { return this.session?.expiresAt ?? 0; }
  getUserData(): any { return this.session?.usuario ?? {}; }
  getToken(): string | null { return null; }
  getRefreshToken(): string | null { return null; }
  clearSession(): void {
    this.version++;
    this.consulta = undefined;
    this.session = null;
    this.authStatusSubject.next(false);
  }
  validarSesion(): Observable<PortalSession> {
    if (!this.consulta) {
      const version = this.version;
      const request = this.http.get<PortalSession>('/api/auth/me').pipe(
        map(value => version === this.version ? this.actualizarSesion(value) : { success: false, authenticated: false }),
        catchError(() => {
          if (version === this.version) this.clearSession();
          return of({ success: false, authenticated: false });
        }),
        finalize(() => { if (this.consulta === request) this.consulta = undefined; }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.consulta = request;
    }
    return this.consulta;
  }
  actualizarSesion(value: PortalSession): PortalSession {
    if (value?.success !== true || value.authenticated !== true || !Number.isFinite(value.expiresAt) || value.expiresAt! <= Date.now()) {
      this.clearSession();
      return { success: false, authenticated: false };
    }
    // Lista explícita del contrato safeUser del BFF; no conservar campos adicionales.
    const usuario: Record<string, any> = {};
    for (const key of ['idRol', 'idPerfil', 'idBusinessModel', 'userName', 'mail', 'oft', 'cuenta', 'idStatus']) {
      const campo = value.usuario?.[key];
      if (typeof campo === 'string' || typeof campo === 'number') usuario[key] = campo;
    }
    this.version++;
    this.consulta = undefined;
    this.session = { success: true, authenticated: true, expiresAt: value.expiresAt, usuario };
    this.authStatusSubject.next(true);
    return this.session;
  }
  searchAccount(userLogin: string, passwordLogin: string, latitud: string, longitud: string): Observable<any> {
    return defer(() => {
      this.clearSession();
      return this.http.post('/api/auth/login', { userLogin, passwordLogin, latitud, longitud });
    });
  }
  validateSmsToken(tokenSms: string): Observable<PortalSession> {
    return defer(() => {
      const version = this.version;
      return this.http.post<PortalSession>('/api/auth/verify-sms', { tokenSms }).pipe(
        map(value => version === this.version ? this.actualizarSesion(value) : { success: false, authenticated: false }),
      );
    });
  }
  completeSmsValidation(): void { /* El servidor valida SMS; no hay activación local. */ }
  logout(): Observable<any> {
    return defer(() => {
      this.version++;
      this.consulta = undefined;
      return this.http.post<{ success: boolean }>('/api/auth/logout', {}).pipe(
        tap(result => {
          if (!result.success) throw new Error('No fue posible cerrar la sesión.');
          this.clearSession();
        }),
      );
    });
  }
  forgotPassword(email: string): Observable<any> { return this.http.post('/api/auth/forgot-password', { email }); }
  updatePassword(passnew: string): Observable<any> { return this.http.put('/api/auth/update-password', { passnew }); }
  getSaldo(): Observable<any> { return this.http.get('/api/account/balance'); }
  getBalance(_accessToken: string, _entS: string): Observable<any> { return this.getSaldo(); }
  validateToken(): any { return { success: this.hasValidSession(), needsLogin: !this.hasValidSession() }; }
}
