import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ConsultaComerciosFiltros {
  nodeID?: string | number | null;
  nameCommerce?: string;
  email?: string;
  telefono?: string;
  rfc?: string;
}

export interface ConsultaComercioApi {
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
  private readonly baseUrl = `${environment.api.kashpay}api/v1/entity/`;

  buscarComercios(filtros: ConsultaComerciosFiltros): Observable<ConsultaComerciosResponse> {
    const nodeID = filtros.nodeID ?? this.obtenerNodeId();
    const params = new HttpParams()
      .set('nodeID', nodeID === null ? '' : String(nodeID))
      .set('nameCommerce', filtros.nameCommerce ?? '')
      .set('email', filtros.email ?? '')
      .set('telefono', filtros.telefono ?? '')
      .set('rfc', filtros.rfc ?? '');

    return this.http.get<ConsultaComerciosResponse>(`${this.baseUrl}searchCommercesByLevel`, {
      headers: this.headers(),
      params,
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

  private obtenerNodeId(): string | null {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.nodeID) return String(session.nodeID);
    } catch {
      // Usa llave legacy abajo.
    }

    return localStorage.getItem('nodeID') || null;
  }

}
