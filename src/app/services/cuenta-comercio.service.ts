import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
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
  private readonly sessionAuth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.kashpay}api/v1/account/`;

  consultarCuenta(sirioId: string, bearerToken?: string): Observable<CuentaComercioResponse> {
    const params = new HttpParams().set('sirioId', sirioId);

    return this.http.get<CuentaComercioResponse>(`${this.baseUrl}get`, {
      headers: this.headers(bearerToken),
      params,
    });
  }

  private headers(bearerToken?: string): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      versionApp: '3',
      Authorization: `Bearer ${bearerToken || this.obtenerToken()}`,
    });
  }

  private obtenerToken(): string {
    return this.sessionAuth.getToken() || '';
  }
}
