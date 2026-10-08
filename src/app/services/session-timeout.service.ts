import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { filter } from 'rxjs';
import { SESSION_EXPIRES_AT_KEY, SESSION_TIMEOUT_MS } from './session-expiration';

@Injectable({
  providedIn: 'root',
})
export class SessionTimeoutService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timeoutMs = SESSION_TIMEOUT_MS;
  private readonly expiresAtKey = SESSION_EXPIRES_AT_KEY;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  readonly mostrarModal = signal(false);
  readonly tokenVencido = signal<string | null>(null);

  iniciar(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.authService.authStatus$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.tokenVencido.set(null);
        this.obtenerOcrearExpiracion();
        this.validarOProgramarSesion();
      } else {
        this.limpiarTimer();
        this.mostrarModal.set(false);
      }
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.validarOProgramarSesion());
    this.zone.runOutsideAngular(() => {
      window.addEventListener('focus', this.validarExpiracion);
      window.addEventListener('storage', this.sincronizarSesion);
      document.addEventListener('visibilitychange', this.validarExpiracion);
    });
    this.destroyRef.onDestroy(() => {
      this.limpiarTimer(false);
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

    this.zone.runOutsideAngular(() => {
      this.timerId = setTimeout(() => {
        this.zone.run(() => this.validarOProgramarSesion());
      }, tiempoRestante);
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

  private readonly validarExpiracion = (): void => this.validarVencimiento();

  private readonly sincronizarSesion = (event: StorageEvent): void => {
    if (event.key === this.expiresAtKey || event.key === 'auth_session' || event.key === null) {
      this.zone.run(() => this.validarOProgramarSesion());
    }
  };

  validarVencimiento(): void {
    const expiresAt = Number(localStorage.getItem(this.expiresAtKey) || 0);
    if (!this.authService.hasValidSession() || !expiresAt || Date.now() < expiresAt) {
      return;
    }

    this.zone.run(() => this.cerrarSesionPorTiempo());
  }

  private validarOProgramarSesion(): void {
    if (!this.esRutaDelPortal()) {
      // La sesión vence también aquí, pero el aviso es exclusivo del portal.
      this.mostrarModal.set(false);
    }

    if (!this.authService.hasValidSession()) {
      this.limpiarTimer();
      return;
    }

    this.iniciarTimer();
  }

  private esRutaDelPortal(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['sessionTimeout'] === true;
  }

  private obtenerOcrearExpiracion(): number {
    const expiresAt = Number(localStorage.getItem(this.expiresAtKey) || 0);
    if (expiresAt) return expiresAt;

    const nuevaExpiracion = Date.now() + this.timeoutMs;
    localStorage.setItem(this.expiresAtKey, String(nuevaExpiracion));
    return nuevaExpiracion;
  }

  private cerrarSesionPorTiempo(): void {
    this.limpiarTimer(false);
    if (!this.authService.hasValidSession()) {
      localStorage.removeItem(this.expiresAtKey);
      return;
    }

    this.tokenVencido.set(this.authService.getToken());
    localStorage.removeItem(this.expiresAtKey);
    this.authService.logout().subscribe({
      next: () => this.mostrarModal.set(this.esRutaDelPortal()),
      error: () => {
        this.authService.clearSession();
        this.mostrarModal.set(this.esRutaDelPortal());
      },
    });
  }

  aceptarCierreSesion(): void {
    this.mostrarModal.set(false);
    this.router.navigate(['/']);
  }
}
