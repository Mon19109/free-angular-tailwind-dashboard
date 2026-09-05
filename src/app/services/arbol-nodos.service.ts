import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ArbolNodoApi {
  id?: string | number;
  nodeID?: string | number;
  idNode?: string | number;
  idSirio?: string;
  levelType?: string | number;
  depth?: string | number;
  guid?: string;
  commerceGuid?: string;
  commerceID?: string;
  pldID?: string;
  pldId?: string;
  PLDID?: string;
  name?: string;
  nodeName?: string;
  contextDescription?: string;
  nameCommerce?: string;
  businessName?: string;
  tuName?: string;
  idAffilationLevel?: string;
  level?: string;
  type?: string;
  children?: ArbolNodoApi[];
  childs?: ArbolNodoApi[];
  nodes?: ArbolNodoApi[];
  tree?: ArbolNodoApi[];
  data?: ArbolNodoApi[] | ArbolNodoApi;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ArbolNodosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.api.kashpay;

  obtenerArbol(nodeID: string | number): Observable<ArbolNodoApi> {
    return this.http.get<ArbolNodoApi>(
      `${this.baseUrl}api/nodes/${encodeURIComponent(String(nodeID))}/tree`,
      {
        headers: this.headers(),
        params: new HttpParams().set('levels', '').set('type', '')
      }
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
