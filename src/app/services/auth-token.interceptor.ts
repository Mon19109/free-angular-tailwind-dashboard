import { HttpInterceptorFn } from '@angular/common/http';

function getStoredAccessToken(): string | null {
  const rawSession = localStorage.getItem('auth_session');

  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      if (session?.token) {
        return session.token;
      }
    } catch {
      localStorage.removeItem('auth_session');
    }
  }

  return localStorage.getItem('token') || localStorage.getItem('auth_token');
}

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.includes('/OAuthServices/')) {
    return next(request);
  }

  const currentAuthorization = request.headers.get('Authorization');
  if (currentAuthorization?.startsWith('Bearer ')) {
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
