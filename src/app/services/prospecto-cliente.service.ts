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
  prospectId?: string;
  link: string;
  liquidacion: Record<string, unknown>;
  accesos: Record<string, unknown>;
}

export interface ValidarTokenSmsPayload {
  commerceGuid: string;
  id: string;
  observations: string;
}

@Injectable({ providedIn: 'root' })
export class ProspectoClienteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.KashpayCoreAPI;
   private readonly apiUrl2 = environment.api.kashpay;

  obtenerProspecto(prospectId: string, link: string): Observable<ProspectoClienteResponse> {
    let params = new HttpParams().set('link', link);
    if (prospectId) params = params.set('prospectId', prospectId);

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

  validarTokenSms(payload: ValidarTokenSmsPayload): Observable<unknown> {
    return this.http.post(
      //`${this.apiUrl}prospect/validateTokenSms`,
       `${this.apiUrl2}api/commerce/validateOperationWithSMSToken`,
      payload,
      { headers: this.headers() }
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      versionApp: '3',
      //Authorization: `Bearer ${this.obtenerToken()}`
      Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc`
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
