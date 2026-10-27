import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ArbolNodoApi {
  id?: string | number;
  nodeId?: string | number;
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
  private readonly sessionAuth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.api.kashpay;

  obtenerArbol(nodeID: string | number, bearerToken?: string, status?: number): Observable<ArbolNodoApi> {
    let params = new HttpParams().set('levels', '');
    if (status !== undefined) params = params.set('status', status);
    return this.http.get<ArbolNodoApi>(
      `${this.baseUrl}api/nodes/${encodeURIComponent(String(nodeID))}/tree`,
      {
        headers: this.headers(bearerToken),
        params
      }
    );
  }

  private headers(bearerToken?: string): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken || this.obtenerToken()}`
    });
  }

  private obtenerToken(): string {
    return this.sessionAuth.getToken() || '';
  }
}
