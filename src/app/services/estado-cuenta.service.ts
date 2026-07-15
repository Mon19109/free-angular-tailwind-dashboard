import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface EstadoCuentaParams {
  tipo: 'PDF' | 'EXCEL';
  periodo: string;
  cuenta: string;
  clabe: string;
}

@Injectable({
  providedIn: 'root'
})
export class EstadoCuentaService {
  private baseUrl = environment.api.kashpay;
  private apiV1Url = `${this.baseUrl}api/v1/`;
  private saldosUrl = environment.api.saldos;
  private exportadorUrl = 'https://sdbx-portal-antares.kashplataforma.com/public/assets/exportar/estadoCuenta.php';

  constructor(private http: HttpClient) {}

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  obtenerCuentas(): Observable<any> {
    const sirioId = localStorage.getItem('entitySonID') || '';

    return this.http.get(
      `${this.apiV1Url}account/getConcentratorAccounts?sirioId=${sirioId}`,
      { headers: this.getCommonHeaders() }
    );
  }

  obtenerSaldo(idContext: string): Observable<any> {
    return this.http.get(
      `${this.saldosUrl}getBalance/${idContext}`,
      { headers: this.getCommonHeaders() }
    );
  }

  construirUrlDescarga(paramsData: EstadoCuentaParams): string {
    const params = new URLSearchParams({
      idAffiliationLevel: localStorage.getItem('idRol') || '',
      tipo: paramsData.tipo,
      anio: paramsData.periodo,
      cuenta: paramsData.cuenta,
      clabe: paramsData.clabe
    });

    return `${this.exportadorUrl}?${params.toString()}`;
  }
}
