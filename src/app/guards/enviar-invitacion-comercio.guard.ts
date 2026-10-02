import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canSendCommerceInvitation } from '../shared/services/session-role';

export const enviarInvitacionComercioGuard: CanActivateFn = () =>
  canSendCommerceInvitation() || inject(Router).createUrlTree(['/dashboard']);
