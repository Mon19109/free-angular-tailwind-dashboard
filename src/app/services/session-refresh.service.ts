import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { PortalSession } from './auth.service';
export interface SessionRefreshResponse extends PortalSession { message?: string; }
@Injectable({ providedIn: 'root' })
export class SessionRefreshService {
  private readonly http = inject(HttpClient);
  private readonly renovada = new Subject<void>();
  readonly renovada$ = this.renovada.asObservable();
  renovar(): Observable<SessionRefreshResponse> {
    return this.http.post<SessionRefreshResponse>('/api/auth/refresh', {}).pipe(
      tap(result => {
        if (result?.success === true && result.authenticated === true &&
            Number.isFinite(result.expiresAt) && result.expiresAt! > Date.now()) this.renovada.next();
      })
    );
  }
}
