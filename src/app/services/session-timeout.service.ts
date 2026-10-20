import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    this.auth.authStatus$.pipe(takeUntilDestroyed(this.destroy)).subscribe(active => {
      const anterior = this.expiresAt;
      this.expiresAt = this.auth.getSessionExpiry();
      if (active) {
        this.mostrarModal.set(false);
        this.validarOProgramar();
      } else {
        this.clearTimer(); this.cancelarRenovacion(); this.mostrarAviso.set(false);
        if (anterior && this.esPortal()) this.mostrarModal.set(true);
      }
    });
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (!this.esPortal()) this.mostrarModal.set(false);
      this.validarOProgramar();
    });
    window.addEventListener('focus', this.revisar);
    document.addEventListener('visibilitychange', this.revisar);
    this.destroy.onDestroy(() => {
      window.removeEventListener('focus', this.revisar);
      document.removeEventListener('visibilitychange', this.revisar);
      this.clearTimer(); this.cancelarRenovacion();
    });
    // Los guards consultan /me al entrar al portal; prerregistro no necesita sesión.
    if (this.esPortal()) this.auth.validarSesion().subscribe();
  }
  private esPortal(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route) {
      if (route.data?.['sessionTimeout'] === true) return true;
      if (!route.firstChild) break;
      route = route.firstChild;
    }
    return false;
  }
  private readonly revisar = () => this.zone.run(() => this.validarOProgramar());
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  private cancelarRenovacion(): void { this.refreshSub?.unsubscribe(); this.refreshSub = undefined; this.renovando.set(false); }
  private validarOProgramar(): void {
    this.clearTimer();
    if (!this.expiresAt) { this.mostrarAviso.set(false); return; }
    const remaining = this.expiresAt - Date.now();
    // Comprobar vencimiento antes de hasValidSession(), que ya devuelve false al expirar.
    if (remaining <= 0) { this.informarVencimiento(); return; }
    this.segundosRestantes.set(Math.ceil(remaining / 1000));
    this.mostrarAviso.set(this.esPortal() && remaining <= SESSION_WARNING_MS);
    this.timer = setTimeout(() => this.zone.run(() => this.validarOProgramar()),
      remaining > SESSION_WARNING_MS ? remaining - SESSION_WARNING_MS : Math.min(1000, remaining));
  }
  validarVencimiento(_entradaAlPortal = false): void { this.validarOProgramar(); }
  informarVencimiento(): void {
    const teniaSesion = !!this.expiresAt || !!this.auth.getSessionExpiry();
    this.clearTimer(); this.cancelarRenovacion(); this.mostrarAviso.set(false);
    this.expiresAt = 0;
    this.auth.clearSession();
    if (teniaSesion && this.esPortal()) this.mostrarModal.set(true);
  }
  mantenerSesion(): void {
    this.validarOProgramar();
    if (!this.mostrarAviso() || this.renovando() || !this.auth.hasValidSession()) return;
    this.renovando.set(true); this.errorRenovacion.set('');
    this.refreshSub = this.refresh.renovar().subscribe({
      next: result => {
        this.renovando.set(false);
        if (!result.success || !result.authenticated || !result.expiresAt) {
          this.informarVencimiento(); return;
        }
        this.auth.actualizarSesion(result);
      },
      error: error => {
        this.renovando.set(false);
        if (error.status === 401) this.informarVencimiento();
        else this.errorRenovacion.set('No fue posible renovar la sesión. Intenta nuevamente antes de que venza.');
      }
    });
  }
  cerrarSesion(): void {
    this.cancelarRenovacion();
    this.auth.logout().subscribe({
      next: () => { this.clearTimer(); this.mostrarAviso.set(false); this.aceptarCierreSesion(); },
      error: () => { this.errorRenovacion.set('No fue posible cerrar la sesión en el servidor. Intenta nuevamente.'); }
    });
  }
  aceptarCierreSesion(): void { this.mostrarModal.set(false); this.router.navigate(['/']); }
}
