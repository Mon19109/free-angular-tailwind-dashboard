import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canAddCommerceLevel } from '../shared/services/session-role';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const agregarNivelComercioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.validarSesion().pipe(map(() =>
    (auth.hasValidSession() && canAddCommerceLevel(Number(auth.getSessionValue('idRol'))))
      || router.createUrlTree(['/dashboard'])));
};
