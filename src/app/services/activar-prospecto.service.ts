import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ActivarProspectoPayload {
  commerceGuid: string;
}

@Injectable({ providedIn: 'root' })
export class ActivarProspectoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/commerce/activateProspect`;

  activarProspecto(commerceGuid: string): Observable<unknown> {
    return this.http.post(
      this.url,
      { commerceGuid },
      { headers: this.headers() }
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.obtenerToken()}`
    });
  }

  private obtenerToken(): string {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Usa llaves legacy abajo.
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }
}
