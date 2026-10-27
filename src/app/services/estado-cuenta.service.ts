import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
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
  private readonly sessionAuth = inject(AuthService);
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

  private getBearerHeaders(): HttpHeaders {
    const token = this.getStoredToken();

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private getStoredToken(): string {
    return this.sessionAuth.getToken() || '';
  }

  obtenerCuentas(): Observable<any> {
    const sirioId = this.sessionAuth.getSessionValue('entitySonID') || '';

    return this.http.get(
      `${this.apiV1Url}account/getConcentratorAccounts?sirioId=${sirioId}`,
      { headers: this.getBearerHeaders() }
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
      idAffiliationLevel: this.sessionAuth.getSessionValue('idRol') || '',
      tipo: paramsData.tipo,
      anio: paramsData.periodo,
      cuenta: paramsData.cuenta,
      clabe: paramsData.clabe
    });

    return `${this.exportadorUrl}?${params.toString()}`;
  }
}
