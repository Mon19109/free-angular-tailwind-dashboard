import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionTimeoutService } from '../services/session-timeout.service';
export const sessionExpirationInterceptor: HttpInterceptorFn = (request, next) => {
  const timeout = inject(SessionTimeoutService);
  return next(request).pipe(catchError(error => {
    const privada = request.url.startsWith('/api/account/') || request.url === '/api/auth/refresh' || request.url === '/api/auth/update-password';
    if (privada && error.status === 401) timeout.informarVencimiento();
    return throwError(() => error);
  }));
};
