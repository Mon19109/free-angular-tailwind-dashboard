import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';


import { HttpContext } from '@angular/common/http';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';
export interface ProspectoClienteResponse {
  success?: boolean;
  message?: string;
  error?: { name?: string; message?: string; code?: string };
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
  liquidacion?: Record<string, unknown>;
  accesos: Record<string, unknown>;
}

export interface ValidarTokenSmsPayload { tokenSms: string; }

@Injectable({ providedIn: 'root' })
export class ProspectoClienteService {
  private readonly http = inject(HttpClient);


 obtenerProspecto(
  _prospectId: string,
  link: string
): Observable<ProspectoClienteResponse> {
  const params = new HttpParams().set('link', link);

  return this.http.get<ProspectoClienteResponse>(
    '/api/seguimiento-prospecto/prospecto',
    {
      params,
      withCredentials: true,
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
    }
  );
}

  guardarCapturaCliente(payload: ProspectoClienteCapturaPayload): Observable<unknown> {
    // No hay un contrato público autorizado para esta escritura; nunca usar un Bearer fijo como permiso.
    return throwError(() => new Error('La captura pública requiere una operación autorizada del BFF.'));
  }

  validarTokenSms(payload: ValidarTokenSmsPayload): Observable<unknown> {
    return this.http.post('/api/seguimiento-prospecto/validar-sms',
      { tokenSms: payload.tokenSms },
      { withCredentials: true, context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
        headers: { 'X-Portal-Request': '1' } });
  }

}
