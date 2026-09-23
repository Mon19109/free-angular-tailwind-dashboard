import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export type NivelAltaComercio = 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja';

export interface AltaNivelComercioPayload {
  parentNodeId: number;
  nameCommerce: string;
  businessName?: string;
  idBussinesLine?: number;
  businessActivityCode?: string;
  bussinesLineDescription?: string;
  idActivity?: number;
  email?: string;
  name?: string;
  paternalSurname?: string;
  maternalSurname?: string;
  phoneNumber?: string;
  rfc?: string;
  curp?: string;
  fiscalRegime?: string;
  typePerson?: string;
  assignClabeAccount?: boolean;
  liquidationLevel: string;
  dispersionAccount: string;
  isAliasUser?: boolean;
  typeOfBusiness: number;
  commerceAddress?: unknown[];
  contacts?: unknown[];
}

@Injectable({ providedIn: 'root' })
export class AgregarNivelComercioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.KashpayCoreAPI;

  crearSubAfiliado(payload: AltaNivelComercioPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}subAffiliation`, payload, { headers: this.headers() });
  }

  crearEntidad(payload: AltaNivelComercioPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}entity`, payload, { headers: this.headers() });
  }

  crearSucursal(payload: AltaNivelComercioPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}branchOffice`, payload, { headers: this.headers() });
  }

  crearCaja(payload: AltaNivelComercioPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}collaborator`, payload, { headers: this.headers() });
  }

  crearPorNivel(nivel: NivelAltaComercio, payload: AltaNivelComercioPayload): Observable<unknown> {
    if (nivel === 'Sub Afiliado') return this.crearSubAfiliado(payload);
    if (nivel === 'Entidad') return this.crearEntidad(payload);
    if (nivel === 'Sucursal') return this.crearSucursal(payload);
    return this.crearCaja(payload);
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.obtenerToken()}`
    });
  }

  private obtenerToken(): string {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Fallback a llaves legacy.
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || environment.api.BEARER_TOKEN || '';
  }
}
