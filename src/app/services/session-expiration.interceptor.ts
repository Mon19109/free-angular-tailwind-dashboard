import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';
import { SessionTimeoutService } from './session-timeout.service';

export const sessionExpirationInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionTimeout = inject(SessionTimeoutService);
  // El navegador puede posponer los temporizadores de una pestaña suspendida.
  // Comprobar la hora antes de enviar evita usar el token vencido al reanudarla.
  sessionTimeout.validarVencimiento();
  const authorization = request.headers.get('Authorization');
  const tokenVencido = sessionTimeout.tokenVencido();
  const usaTokenVencido = !!tokenVencido && authorization === `Bearer ${tokenVencido}`;
  const sinTokenTrasCierre = !authorization && sessionTimeout.mostrarModal()
    && !request.context.get(SKIP_AUTH_TOKEN);

  if (usaTokenVencido || sinTokenTrasCierre) {
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'Sesión vencida',
      url: request.url,
      error: { code: 'SESSION_EXPIRED', message: 'La sesión alcanzó su límite de 10 minutos.' },
    }));
  }

  return next(request);
};
