import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { SeguimientoNavigationService } from './seguimiento-navigation.service';
export interface ProspectoClienteResponse {
  success?: boolean;
  smsValidated?: boolean;
  completion?: { status: 'NOT_STARTED' | 'CONFIRMED' | 'PENDING' | 'REJECTED' };
  registration?: { status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'UNVERIFIED'; liquidationComplete: boolean | null; platformComplete: boolean | null };
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
  private readonly navigation = inject(SeguimientoNavigationService);


 obtenerProspecto(
  _prospectId: string,
  link: string
): Observable<ProspectoClienteResponse> {
  return this.navigation.request(options => link
    ? this.http.post<ProspectoClienteResponse>('/api/seguimiento-prospecto/prospecto', { link }, options)
    : this.http.get<ProspectoClienteResponse>('/api/seguimiento-prospecto/prospecto', options));
}

  guardarCapturaCliente(payload: ProspectoClienteCapturaPayload): Observable<unknown> {
    // No hay un contrato público autorizado para esta escritura; nunca usar un Bearer fijo como permiso.
    return throwError(() => new Error('La captura pública requiere una operación autorizada del BFF.'));
  }

  validarTokenSms(payload: ValidarTokenSmsPayload): Observable<unknown> {
    return this.navigation.request(options => this.http.post('/api/seguimiento-prospecto/validar-sms',
      { tokenSms: payload.tokenSms },
      options));
  }

}
