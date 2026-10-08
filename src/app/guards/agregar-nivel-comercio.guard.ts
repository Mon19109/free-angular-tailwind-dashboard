import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canAddCommerceLevel } from '../shared/services/session-role';

export const agregarNivelComercioGuard: CanActivateFn = () =>
  canAddCommerceLevel() || inject(Router).createUrlTree(['/dashboard']);
