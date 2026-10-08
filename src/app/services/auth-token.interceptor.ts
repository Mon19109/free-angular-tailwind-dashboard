import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';

export const SKIP_AUTH_TOKEN = new HttpContextToken<boolean>(() => false);

function getStoredAccessToken(): string | null {
  const rawSession = localStorage.getItem('auth_session');

  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      if (session?.smsValidated === true && session?.token) {
        return session.token;
      }
    } catch {
      localStorage.removeItem('auth_session');
    }
  }

  return localStorage.getItem('token') || localStorage.getItem('auth_token');
}

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_AUTH_TOKEN) || request.url.includes('/OAuthServices/')) {
    return next(request);
  }

  const currentAuthorization = request.headers.get('Authorization');
  if (currentAuthorization) {
    // Algunos servicios conservan sus headers desde antes de renovar la sesión.
    // Sustituir únicamente tokens previos de esta sesión; respetar bearers públicos.
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session.smsValidated === true && session.token && Array.isArray(session.tokensAnteriores)
        && session.tokensAnteriores.some((token: string) => currentAuthorization === `Bearer ${token}`)) {
        return next(request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } }));
      }
    } catch { /* Continúa con el header original si no hay una sesión legible. */ }
    return next(request);
  }

  const accessToken = getStoredAccessToken();

  if (!accessToken) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return next(authenticatedRequest);
};
