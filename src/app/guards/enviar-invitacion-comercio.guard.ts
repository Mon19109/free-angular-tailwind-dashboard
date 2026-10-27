import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canSendCommerceInvitation } from '../shared/services/session-role';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const enviarInvitacionComercioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.validarSesion().pipe(map(() =>
    (auth.hasValidSession() && canSendCommerceInvitation(Number(auth.getSessionValue('idRol'))))
      || router.createUrlTree(['/dashboard'])));
};
