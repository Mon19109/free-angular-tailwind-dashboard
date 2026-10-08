import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Subscription, filter } from 'rxjs';
import { SessionRefreshService } from './session-refresh.service';
import { SESSION_EXPIRES_AT_KEY, SESSION_TIMEOUT_MS } from './session-expiration';

@Injectable({
  providedIn: 'root',
})
export class SessionTimeoutService {
  private readonly authService = inject(AuthService);
  private readonly refreshService = inject(SessionRefreshService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timeoutMs = SESSION_TIMEOUT_MS;
  private readonly expiresAtKey = SESSION_EXPIRES_AT_KEY;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private refreshSubscription?: Subscription;
  private readonly avisoMs = 10 * 1000;
  private started = false;
  readonly mostrarAviso = signal(false);
  readonly segundosRestantes = signal(10);
  readonly renovando = signal(false);
  readonly errorRenovacion = signal('');
  private cierrePendiente = false;
  readonly mostrarModal = signal(false);
  readonly tokenVencido = signal<string | null>(null);

  iniciar(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.authService.authStatus$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.cierrePendiente = false;
        this.errorRenovacion.set('');
        this.tokenVencido.set(null);
        this.obtenerOcrearExpiracion();
        this.validarOProgramarSesion();
      } else {
        this.cancelarRenovacion();
        this.mostrarAviso.set(false);
        this.limpiarTimer();
        if (!this.cierrePendiente) this.mostrarModal.set(false);
      }
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.esRutaDelPortal()) {
          this.cierrePendiente = false;
          this.mostrarModal.set(false);
        }
        this.validarOProgramarSesion();
      });
    this.zone.runOutsideAngular(() => {
      window.addEventListener('focus', this.validarExpiracion);
      window.addEventListener('storage', this.sincronizarSesion);
      document.addEventListener('visibilitychange', this.validarExpiracion);
    });
    this.destroyRef.onDestroy(() => {
      this.limpiarTimer(false);
      this.cancelarRenovacion();
      window.removeEventListener('focus', this.validarExpiracion);
      window.removeEventListener('storage', this.sincronizarSesion);
      document.removeEventListener('visibilitychange', this.validarExpiracion);
    });
    this.validarOProgramarSesion();
  }

  private iniciarTimer(): void {
    this.limpiarTimer(false);
    this.mostrarModal.set(false);
    if (!this.authService.hasValidSession()) {
      return;
    }

    const expiresAt = this.obtenerOcrearExpiracion();
    const tiempoRestante = expiresAt - Date.now();
    if (tiempoRestante <= 0) {
      this.cerrarSesionPorTiempo();
      return;
    }

    const enAviso = tiempoRestante <= this.avisoMs;
    this.segundosRestantes.set(Math.ceil(tiempoRestante / 1000));
    this.mostrarAviso.set(enAviso && this.esRutaDelPortal());
    this.zone.runOutsideAngular(() => {
      this.timerId = setTimeout(() => {
        this.zone.run(() => this.validarOProgramarSesion());
      }, enAviso ? Math.min(1000, tiempoRestante) : tiempoRestante - this.avisoMs);
    });
  }

  private limpiarTimer(limpiarExpiracion = true): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (limpiarExpiracion) {
      localStorage.removeItem(this.expiresAtKey);
    }
  }

  private readonly validarExpiracion = (): void => {
    this.zone.run(() => this.validarOProgramarSesion());
  };

  private readonly sincronizarSesion = (event: StorageEvent): void => {
    if (event.key === this.expiresAtKey || event.key === 'auth_session' || event.key === null) {
      this.zone.run(() => this.validarOProgramarSesion());
    }
  };

  validarVencimiento(entradaAlPortal = false): void {
    const expiresAt = Number(localStorage.getItem(this.expiresAtKey) || 0);
    if (!this.authService.hasValidSession() || !expiresAt || Date.now() < expiresAt) {
      return;
    }

    this.zone.run(() => this.cerrarSesionPorTiempo(entradaAlPortal));
  }

  private validarOProgramarSesion(): void {
    if (this.cierrePendiente) return;

    if (!this.authService.hasValidSession()) {
      this.cancelarRenovacion();
      this.mostrarAviso.set(false);
      this.limpiarTimer();
      return;
    }

    this.iniciarTimer();
  }

  private esRutaDelPortal(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
      if (route.data['sessionTimeout'] === true) return true;
    }
    return false;
  }

  private obtenerOcrearExpiracion(): number {
    const expiresAt = Number(localStorage.getItem(this.expiresAtKey) || 0);
    if (expiresAt) return expiresAt;

    const nuevaExpiracion = Date.now() + this.timeoutMs;
    localStorage.setItem(this.expiresAtKey, String(nuevaExpiracion));
    return nuevaExpiracion;
  }

  private cerrarSesionPorTiempo(entradaAlPortal = false): void {
    this.limpiarTimer(false);
    this.cancelarRenovacion();
    this.mostrarAviso.set(false);
    if (!this.authService.hasValidSession()) {
      localStorage.removeItem(this.expiresAtKey);
      return;
    }

    // Mantener el aviso mientras se invalida la sesión; los guards no deben
    // redirigir al login hasta que el usuario lo confirme.
    this.cierrePendiente = entradaAlPortal || this.esRutaDelPortal();
    this.mostrarModal.set(this.cierrePendiente);
    this.tokenVencido.set(this.authService.getToken());
    this.authService.logout().subscribe({
      error: () => this.authService.clearSession(),
    });
  }

  mantenerSesion(): void {
    this.validarVencimiento();
    if (!this.mostrarAviso() || this.renovando() || !this.authService.hasValidSession()) return;
    const refreshToken = this.authService.getRefreshToken();
    if (!refreshToken) {
      this.errorRenovacion.set('No fue posible renovar esta sesión. Vuelve a iniciar sesión cuando termine el contador.');
      return;
    }

    this.renovando.set(true);
    this.errorRenovacion.set('');
    this.refreshSubscription = this.refreshService.renovar(refreshToken).subscribe({
      next: respuesta => {
        this.renovando.set(false);
        const accessToken = respuesta.authResponse?.accessToken;
        if (respuesta.success === false || typeof accessToken !== 'string' || !accessToken.trim()) {
          this.errorRenovacion.set(respuesta.error?.message || respuesta.message || 'No fue posible renovar la sesión.');
          return;
        }
        const actualizada = this.authService.actualizarSesionRenovada(accessToken, respuesta.authResponse?.refreshToken, refreshToken);
        if (actualizada) this.validarOProgramarSesion();
        else this.validarVencimiento();
      },
      error: error => {
        this.renovando.set(false);
        this.errorRenovacion.set(error?.error?.error?.message || error?.error?.message || 'No fue posible renovar la sesión.');
      },
    });
  }

  private cancelarRenovacion(): void {
    this.refreshSubscription?.unsubscribe();
    this.refreshSubscription = undefined;
    this.renovando.set(false);
  }

  aceptarCierreSesion(): void {
    this.cierrePendiente = false;
    this.mostrarModal.set(false);
    this.router.navigate(['/']);
  }
}
