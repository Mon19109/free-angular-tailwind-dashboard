import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const dashboardPreregistroClientesGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.validarSesion().pipe(
    map(() =>
      (
        auth.hasValidSession() &&
        Number(auth.getSessionValue('idRol')) === 2
      ) || router.createUrlTree(['/dashboard'])
    )
  );
};
