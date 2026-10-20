import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionTimeoutService } from '../services/session-timeout.service';
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly timeout = inject(SessionTimeoutService);
  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) { return this.check(route); }
  canActivateChild(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) { return this.check(route); }
  private check(route: ActivatedRouteSnapshot) {
    return this.auth.validarSesion().pipe(map(session => {
      if (!session.authenticated || !this.auth.hasValidSession()) {
        return this.timeout.mostrarModal() ? false : this.router.createUrlTree(['/']);
      }
      const roles = route.data['roles'] as number[] | undefined;
      if (roles?.length && !roles.includes(Number(session.usuario?.idRol))) return this.router.createUrlTree(['/']);
      return true;
    }));
  }
}
