import { HttpInterceptorFn } from '@angular/common/http';
// El BFF valida sesión y vencimiento. No inspeccionamos JWT en Angular.
export const sessionExpirationInterceptor: HttpInterceptorFn = (request, next) => next(request);
