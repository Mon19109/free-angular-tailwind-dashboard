import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { NavigationLoaderService } from './navigation-loader.service';

export const navigationLoaderInterceptor: HttpInterceptorFn = (request, next) => {
  const complete = inject(NavigationLoaderService).trackRequest();
  return next(request).pipe(finalize(complete));
};
