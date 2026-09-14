import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ProspectoClienteResponse {
  success?: boolean;
  accountResponse?: ProspectoCliente;
  [key: string]: unknown;
}

export interface ProspectoCliente {
  id?: string | null;
  guid?: string | null;
  commerceGuid?: string | null;
  guidCommerce?: string | null;
  nameCommerce?: string | null;
  businessName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  url?: string | null;
  aliasUser?: boolean;
  dispersionAccount?: unknown;
  liquidationType?: unknown;
  liquidationLevel?: unknown;
  [key: string]: unknown;
}

export interface ProspectoClienteCapturaPayload {
  prospectId: string;
  link: string;
  liquidacion: Record<string, unknown>;
  accesos: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ProspectoClienteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.KashpayCoreAPI;

  obtenerProspecto(prospectId: string, link: string): Observable<ProspectoClienteResponse> {
    const params = new HttpParams()
      .set('prospectId', prospectId)
      .set('link', link);

    return this.http.get<ProspectoClienteResponse>(
      `${this.apiUrl}prospect`,
      { params, headers: this.headers() }
    );
  }

  guardarCapturaCliente(payload: ProspectoClienteCapturaPayload): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}prospect`,
      payload,
      { headers: this.headers() }
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      versionApp: '3',
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
