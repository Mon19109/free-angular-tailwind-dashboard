import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError, map } from 'rxjs';

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
  movilEncrip = '';

  // El servidor obtiene la IP real a partir del proxy de confianza.
  obtenerIp(): Observable<string> { return of(''); }
  hasValidSession(): boolean { return this.session?.authenticated === true && (this.session.expiresAt ?? 0) > Date.now(); }
  getSessionExpiry(): number { return this.session?.expiresAt ?? 0; }
  getUserData(): any { return this.session?.usuario ?? {}; }
  getToken(): string | null { return null; } // Nunca exponer tokens a Angular.
  getRefreshToken(): string | null { return null; }
  clearSession(): void { this.session = null; this.authStatusSubject.next(false); }

  validarSesion(): Observable<PortalSession> {
    return this.http.get<PortalSession>('/api/auth/me').pipe(
      tap(value => this.setSession(value)),
      catchError(() => { this.clearSession(); return of({ success: false, authenticated: false }); })
    );
  }
  private setSession(value: PortalSession): void {
    this.session = value.authenticated ? value : null;
    this.authStatusSubject.next(this.hasValidSession());
  }
  searchAccount(userLogin: string, passwordLogin: string, latitud: string, longitud: string): Observable<any> {
    return this.http.post('/api/auth/login', { userLogin, passwordLogin, latitud, longitud });
  }
  validateSmsToken(tokenSms: string): Observable<any> {
    return this.http.post('/api/auth/verify-sms', { tokenSms }).pipe(
      tap((result: any) => { if (result?.success && result?.authenticated) this.setSession(result); })
    );
  }
  // Se conserva por compatibilidad con login.component.ts: la activación ocurre en el BFF.
  completeSmsValidation(): void { /* Ya se activó con verify-sms. */ }
  logout(): Observable<any> {
    return this.http.post('/api/auth/logout', {}).pipe(tap(() => this.clearSession()), catchError(() => {
      this.clearSession(); return of({ success: false });
    }));
  }
  forgotPassword(email: string): Observable<any> { return this.http.post('/api/auth/forgot-password', { email }); }
  updatePassword(passnew: string): Observable<any> { return this.http.put('/api/auth/update-password', { passnew }); }
  getSaldo(): Observable<any> { return this.http.get('/api/account/balance'); }
  getBalance(_accessToken: string, _entS: string): Observable<any> { return this.getSaldo(); }
  validateToken(): any { return { success: this.hasValidSession(), needsLogin: !this.hasValidSession() }; }
  // Los métodos de autenticación internos ahora solo deben existir en Node.js.
}
