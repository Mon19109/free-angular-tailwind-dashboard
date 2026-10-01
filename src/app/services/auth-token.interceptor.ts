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
