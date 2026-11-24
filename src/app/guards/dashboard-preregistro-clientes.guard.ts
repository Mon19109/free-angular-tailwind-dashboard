import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const dashboardPreregistroClientesGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.validarSesion().pipe(
    map(() => {
      const idRol = Number(auth.getSessionValue('idRol'));
      const idPerfil = Number(auth.getSessionValue('idPerfil'));

      const esDashboard =
        route.routeConfig?.path === 'dashboard_preregistro_clientes';

      const permitido =
  auth.hasValidSession() &&
  (
    (idRol === 2 && idPerfil !== 11) ||
    (idPerfil === 11 && esDashboard)
  );

      return permitido || router.createUrlTree(['/dashboard']);
    })
  );
};