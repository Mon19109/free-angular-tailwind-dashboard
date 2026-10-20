import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthGuard } from './auth.guard';
export const authGuard: CanActivateFn = (route, state) => inject(AuthGuard).canActivate(route, state);
