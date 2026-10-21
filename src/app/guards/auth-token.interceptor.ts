import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
export const SKIP_AUTH_TOKEN = new HttpContextToken<boolean>(() => false);

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  // Solo rutas relativas del BFF de autenticación. No afecta APIs legacy ni prerregistro.
  if (request.url.startsWith('/api/auth/') || request.url.startsWith('/api/comercios/') || request.url.startsWith('/api/account/')) {
    let headers = request.headers.delete('Authorization');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) headers = headers.set('X-Portal-Request', '1');
    // Origin y Sec-Fetch-Site los genera el navegador; no se simulan en Angular.
    return next(request.clone({ withCredentials: true, headers }));
  }
  return next(request);
};
