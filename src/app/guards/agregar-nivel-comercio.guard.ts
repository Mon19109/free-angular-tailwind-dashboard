import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getSessionRole } from '../shared/services/session-role';

export const agregarNivelComercioGuard: CanActivateFn = () =>
  getSessionRole() !== 6 || inject(Router).createUrlTree(['/dashboard']);
