import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
  private readonly api = '/api/aclaraciones';
  private readonly options = { withCredentials: true };

  obtenerTransaccion(id: string, idContext?: string): Observable<any> {
    let params = new HttpParams().set('id', id);
    if (idContext) params = params.set('idContext', idContext);
    return this.http.get(`${this.api}/transaccion`, { ...this.options, params });
  }
  obtenerMotivos(tipo: 'D' | 'DP' | 'CC'): Observable<any> {
    return this.http.get(`${this.api}/motivos`, { ...this.options, params: new HttpParams().set('tipo', tipo) });
  }
  guardar(payload: AclaracionPayload): Observable<any> {
    return this.http.post(`${this.api}/guardar`, payload, this.options);
  }
  agregarEvidencias(idClarification: number, idOperation: string, files: string[]): Observable<any> {
    return this.http.put(`${this.api}/evidencias`, { idClarification, idOperation, files }, this.options);
  }
  validarContrasena(email: string, password: string, latitud: string, longitud: string): Observable<any> {
    return this.http.post(`${this.api}/validar-contrasena`, { email, password, latitud, longitud }, this.options);
  }
}
