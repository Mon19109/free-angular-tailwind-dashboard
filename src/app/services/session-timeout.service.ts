import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SessionTimeoutService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly timeoutMs = 10 * 60 * 1000;
  private readonly expiresAtKey = 'kashpay.session.expiresAt';
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  readonly mostrarModal = signal(false);

  iniciar(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.authService.authStatus$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.iniciarTimer();
      } else {
        this.limpiarTimer();
      }
    });
    this.zone.runOutsideAngular(() => {
      window.addEventListener('focus', this.validarExpiracion);
      document.addEventListener('visibilitychange', this.validarExpiracion);
    });
  }

  private iniciarTimer(): void {
    this.limpiarTimer();
    this.mostrarModal.set(false);
    if (!this.authService.hasValidSession()) {
      return;
    }

    const expiresAt = Date.now() + this.timeoutMs;
    localStorage.setItem(this.expiresAtKey, String(expiresAt));
    this.zone.runOutsideAngular(() => {
      this.timerId = setTimeout(() => {
        this.zone.run(() => this.cerrarSesionPorTiempo());
      }, this.timeoutMs);
    });
  }

  private limpiarTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    localStorage.removeItem(this.expiresAtKey);
  }

  private readonly validarExpiracion = (): void => {
    const expiresAt = Number(localStorage.getItem(this.expiresAtKey) || 0);
    if (!this.authService.hasValidSession() || !expiresAt || Date.now() < expiresAt) {
      return;
    }

    this.zone.run(() => this.cerrarSesionPorTiempo());
  };

  private cerrarSesionPorTiempo(): void {
    this.limpiarTimer();
    if (!this.authService.hasValidSession()) {
      return;
    }

    localStorage.removeItem(this.expiresAtKey);
    this.authService.logout().subscribe({
      next: () => this.mostrarModal.set(true),
      error: () => {
        this.authService.clearSession();
        this.mostrarModal.set(true);
      },
    });
  }

  aceptarCierreSesion(): void {
    this.mostrarModal.set(false);
    this.router.navigate(['/']);
  }
}
