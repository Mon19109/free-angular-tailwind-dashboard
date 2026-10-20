import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
export const SKIP_AUTH_TOKEN = new HttpContextToken<boolean>(() => false);
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.startsWith('/api/')) {
    return next(request.clone({ withCredentials: true, setHeaders: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? {} : { 'X-Portal-Request': '1' } }));
  }
  return next(request);
};
