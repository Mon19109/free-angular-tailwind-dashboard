import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

export interface SessionRefreshResponse {
  success?: boolean;
  authResponse?: { accessToken?: string; refreshToken?: string };
  error?: { message?: string };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionRefreshService {
  private readonly http = inject(HttpClient);

  renovar(refreshToken: string): Observable<SessionRefreshResponse> {
    return this.http.post<SessionRefreshResponse>(`${environment.api.auth.replace(/\/$/, '')}/v2/oauth/refresh`, null, {
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
      headers: new HttpHeaders({ Authorization: `Bearer ${refreshToken}` }),
    });
  }
}
