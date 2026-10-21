import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ConsultaComerciosFiltros {
  nameCommerce?: string;
  email?: string;
  telefono?: string;
  rfc?: string;
  status?: string;
}

export interface ConsultaComercioApi {
  ref?: string;
  displayId?: string;
  nivel?: string;
  jerarquia?: string;
  contextID?: number;
  entityID?: number;
  terminalID?: number;
  terminalUserID?: number;
  userID?: number;
  commerceID?: string;
  entitySonID?: string;
  fatherId?: string | null;
  issueId?: string | null;
  acquiringId?: string | null;
  nameCommerce?: string;
  businessName?: string;
  rfc?: string;
  email?: string;
  fiscalRegime?: string;
  phoneNumber?: string;
  dateTimeCreated?: string;
  idBusinessModel?: number;
  idAffilationLevel?: string;
  guid?: string;
  validate?: string;
  status?: string;
  commerceType?: string;
  typeOfBusiness?: number;
  pldID?: string;
  pldId?: string;
  PLDID?: string;
  nodeID?: number | string;
  [key: string]: unknown;
}

export interface ConsultaPasswordCajaResponse {
  success?: boolean;
  tuPassword?: string;
  password?: string;
  pwd?: string;
  data?: {
    tuPassword?: string;
    password?: string;
    pwd?: string;
    [key: string]: unknown;
  } | string;
  message?: string;
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

export interface ConsultaComerciosResponse {
  success?: boolean;
  commerces?: ConsultaComercioApi[];
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
export class ConsultaComerciosService {
  private readonly http = inject(HttpClient);

  buscarComercios(filtros: ConsultaComerciosFiltros): Observable<ConsultaComerciosResponse> {
    // Lista explícita: nunca reenviar identificadores ni credenciales del consumidor.
    const body = {
      nameCommerce: filtros.nameCommerce ?? '', email: filtros.email ?? '',
      telefono: filtros.telefono ?? '', rfc: filtros.rfc ?? '', status: filtros.status ?? ''
    };
    return this.http.post<ConsultaComerciosResponse>('/api/comercios/buscar', body, {
      withCredentials: true, headers: new HttpHeaders({ 'X-Portal-Request': '1' })
    });
  }

  consultarPasswordCaja(guid: string): Observable<ConsultaPasswordCajaResponse> {
    return this.http.post<ConsultaPasswordCajaResponse>(
      `${environment.api.kashpay}api/v1/user-r7k/v2/shwpwd-f3a917`,
      { guid },
      { headers: this.headers() }
    );
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
