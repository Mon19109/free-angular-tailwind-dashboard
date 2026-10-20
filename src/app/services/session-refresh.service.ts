import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PortalSession } from './auth.service';
export interface SessionRefreshResponse extends PortalSession { message?: string; }
@Injectable({ providedIn: 'root' })
export class SessionRefreshService {
  private readonly http = inject(HttpClient);
  renovar(): Observable<SessionRefreshResponse> {
    return this.http.post<SessionRefreshResponse>('/api/auth/refresh', {});
  }
}
