import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canSendCommerceInvitation } from '../shared/services/session-role';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const enviarInvitacionComercioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.validarSesion().pipe(
    map(() => {
     const idRol = Number(auth.getSessionValue('idRol'));
const idPerfil = Number(auth.getSessionValue('idPerfil'));

const permitido =
  auth.hasValidSession() &&
  (
    idPerfil === 11 ||
    canSendCommerceInvitation(idRol)
  );

return permitido || router.createUrlTree(['/dashboard']);
    })
  );
};