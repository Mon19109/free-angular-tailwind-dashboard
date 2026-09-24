import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface AclaracionPayload {
  idOperation: string;
  idTransactionType: 'D' | 'DP' | 'CC';
  idCatClarification: number;
  authorizationPan: string;
  amount: number;
  observations: string;
  lastUserModify: string;
  idTerminalUser: number;
  authNumber: string;
  retrievalReferenceCode: string;
  files?: string[];
}

@Injectable({ providedIn: 'root' })
export class AclaracionesService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.api.kashpay}api/v1/`;

  private get headers(): HttpHeaders {
    let token = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
    const session = localStorage.getItem('auth_session');
    if (session) {
      try { token = JSON.parse(session)?.token || token; } catch { /* Usa el token disponible. */ }
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}`, versionApp: '3' });
  }

  obtenerTransaccion(id: string, idContext?: string): Observable<any> {
    let params = new HttpParams().set('id', id);
    if (idContext) params = params.set('idContext', idContext);
    return this.http.get(`${this.api}operations/getTransactionById`, { headers: this.headers, params });
  }

  obtenerMotivos(tipo: 'D' | 'DP' | 'CC'): Observable<any> {
    const params = new HttpParams().set('idTransactionType', tipo);
    return this.http.get(`${this.api}clarification/getClarificationCatalog`, { headers: this.headers, params });
  }

  guardar(payload: AclaracionPayload): Observable<any> {
    return this.http.post(`${this.api}clarification/saveClarification`, payload, {
      headers: this.headers.set('bearerToken', this.headers.get('Authorization') || '')
    });
  }

  agregarEvidencias(idClarification: number, idOperation: string, files: string[]): Observable<any> {
    return this.http.put(`${this.api}clarification/updateClarification`, {
      idClarification, idOperation, files
    }, { headers: this.headers });
  }

  validarContrasena(email: string, password: string, latitud: string, longitud: string): Observable<any> {
    return this.http.post(`${this.api}user/login`, {
      email, password,
      device: { os: 'WEB', latitude: latitud, longitude: longitud }
    }, { headers: this.headers });
  }
}
