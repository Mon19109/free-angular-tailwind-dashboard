import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionRefreshService } from './session-refresh.service';
import { SESSION_WARNING_MS } from './session-expiration';
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly auth = inject(AuthService);
  private readonly refresh = inject(SessionRefreshService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private timer?: ReturnType<typeof setTimeout>;
  private refreshSub?: Subscription;
  private expiresAt = 0;
  private started = false;
  readonly mostrarAviso = signal(false);
  readonly segundosRestantes = signal(20);
  readonly renovando = signal(false);
  readonly errorRenovacion = signal('');
  readonly mostrarModal = signal(false);
  readonly tokenVencido = signal<string | null>(null);

  iniciar(): void {
    if (this.started) return;
    this.started = true;
    this.auth.authStatus$.subscribe(() => { this.expiresAt = this.auth.getSessionExpiry(); this.validarOProgramar(); });
    window.addEventListener('focus', this.revisar);
    document.addEventListener('visibilitychange', this.revisar);
    this.destroy.onDestroy(() => {
      window.removeEventListener('focus', this.revisar);
      document.removeEventListener('visibilitychange', this.revisar);
      this.clearTimer(); this.refreshSub?.unsubscribe();
    });
    this.auth.validarSesion().subscribe(s => { if (s.authenticated) this.setExpiresAt(s.expiresAt); });
  }
  private readonly revisar = () => this.zone.run(() => this.validarOProgramar());
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  private setExpiresAt(expiresAt?: number) { this.expiresAt = expiresAt || 0; this.validarOProgramar(); }
  private validarOProgramar(): void {
    this.clearTimer();
    if (!this.auth.hasValidSession()) { this.mostrarAviso.set(false); return; }
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) { this.expirar(); return; }
    this.segundosRestantes.set(Math.ceil(remaining / 1000));
    this.mostrarAviso.set(remaining <= SESSION_WARNING_MS);
    this.timer = setTimeout(() => this.zone.run(() => this.validarOProgramar()),
      remaining > SESSION_WARNING_MS ? remaining - SESSION_WARNING_MS : Math.min(1000, remaining));
  }
  validarVencimiento(_entradaAlPortal = false): void { this.validarOProgramar(); }
  private expirar(): void {
    this.clearTimer(); this.refreshSub?.unsubscribe(); this.mostrarAviso.set(false);
    this.auth.clearSession(); this.mostrarModal.set(true);
    // Redis aplica el vencimiento aunque el usuario no acepte el modal.
  }
  mantenerSesion(): void {
    if (!this.mostrarAviso() || this.renovando()) return;
    this.renovando.set(true); this.errorRenovacion.set('');
    this.refreshSub = this.refresh.renovar().subscribe({
      next: result => {
        this.renovando.set(false);
        if (!result.success || !result.authenticated || !result.expiresAt) {
          this.errorRenovacion.set(result.message || 'No fue posible renovar la sesión.'); return;
        }
        this.auth.validarSesion().subscribe(s => this.setExpiresAt(s.expiresAt));
      },
      error: () => { this.renovando.set(false); this.errorRenovacion.set('No fue posible renovar la sesión.'); }
    });
  }
  cerrarSesion(): void {
    this.refreshSub?.unsubscribe(); this.clearTimer();
    this.auth.logout().subscribe(); this.mostrarAviso.set(false); this.mostrarModal.set(false);
    this.router.navigate(['/']);
  }
  aceptarCierreSesion(): void { this.mostrarModal.set(false); this.router.navigate(['/']); }
}
