import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface CuentaComercioResponse {
  success?: boolean;
  entityInfo?: unknown;
  data?: unknown;
  account?: unknown;
  message?: string;
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class CuentaComercioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.kashpay}api/v1/account/`;

  consultarCuenta(sirioId: string): Observable<CuentaComercioResponse> {
    const params = new HttpParams().set('sirioId', sirioId);

    return this.http.get<CuentaComercioResponse>(`${this.baseUrl}get`, {
      headers: this.headers(),
      params,
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      versionApp: '3',
      Authorization: `Bearer ${this.obtenerToken()}`,
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
