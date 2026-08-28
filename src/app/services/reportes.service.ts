import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface PeriodoReporte {
  anio: string;
  mes: string;
  mesNumero: string;
}

export interface ReporteArchivo {
  name?: string;
  url?: string;
  [key: string]: unknown;
}

export type TipoCuentaReporte = 'EMISION' | 'ADQUIRENTE';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private baseUrl = environment.api.kashpay;
  private apiV1Url = `${this.baseUrl}api/v1/`;
  private saldosUrl = environment.api.saldos;
  private documentsUrl = environment.api.documents;

  constructor(private http: HttpClient) {}

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.getStoredToken()}`
    });
  }

  private getStoredToken(): string {
    const sessionRaw = localStorage.getItem('auth_session');

    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session?.token) return session.token;
      } catch {
        return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
      }
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }

  obtenerCuentas(): Observable<any> {
    const idPerfil = Number(this.getStoredValue('idPerfil'));
    const headers = this.getCommonHeaders();

    if (idPerfil === 8 || idPerfil === 9) {
      const nodeID = this.getStoredValue('nodeID');

      return this.http.get(
        `${this.baseUrl}api/nodes/${encodeURIComponent(nodeID)}/tree`,
        {
          headers,
          params: new HttpParams().set('levels', '').set('type', '')
        }
      );
    }

    return this.http.get(
      `${this.apiV1Url}account/getConcentratorAccounts`,
      {
        headers: headers.set('versionApp', '3'),
        params: new HttpParams().set('sirioId', this.getStoredValue('entitySonID'))
      }
    );
  }

  obtenerSaldo(idContext: string): Observable<any> {
    return this.http.get(
      `${this.saldosUrl}getBalance/${encodeURIComponent(idContext)}`,
      { headers: this.getCommonHeaders() }
    );
  }

  buscarFolderReportes(periodo: string, tipoCuenta: TipoCuentaReporte): Observable<ReporteArchivo[]> {
    return this.listarDirectorio(this.construirFolderReportes(periodo, tipoCuenta));
  }

  buscarArchivosReporte(periodo: string, tipoCuenta: TipoCuentaReporte, reporte: string): Observable<ReporteArchivo[]> {
    return this.listarDirectorio(`${this.construirFolderReportes(periodo, tipoCuenta)}${reporte}`);
  }

  obtenerEstadoCuenta(tipo: 'PDF' | 'EXCEL', periodo: string, cuenta: string, clabe = ''): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new HttpParams()
      .set('idAffiliationLevel', this.getStoredValue('idRol'))
      .set('reportType', tipo)
      .set('month', String(Number(periodoReporte.mesNumero)))
      .set('year', periodoReporte.anio)
      .set('sirioId', cuenta)
      .set('clabe', clabe);

    return this.http.get(`${this.apiV1Url}account/getAccountStatus`, {
      headers: this.getCommonHeaders().set('versionApp', '3'),
      params
    });
  }

  obtenerCorteDia(periodo: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new HttpParams()
      .set('nodeID', this.getStoredValue('nodeID'))
      .set('month', String(Number(periodoReporte.mesNumero)))
      .set('year', periodoReporte.anio);

    return this.http.get(`${this.apiV1Url}reports/getReportTransactions`, {
      headers: this.getCommonHeaders(),
      params
    });
  }

  obtenerDiarioTransacciones(periodo: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new HttpParams()
      .set('nodeID', this.getStoredValue('nodeID'))
      .set('month', String(Number(periodoReporte.mesNumero)))
      .set('year', periodoReporte.anio);

    return this.http.get(`${this.apiV1Url}reports/getDailyTransactionReport`, {
      headers: this.getCommonHeaders(),
      params
    });
  }

  obtenerTransaccionesSplit(periodo: string, cuenta: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new HttpParams()
      .set('account', cuenta)
      .set('month', String(Number(periodoReporte.mesNumero)))
      .set('year', periodoReporte.anio);

    return this.http.get(`${this.apiV1Url}reports/getSplitTransactionReport`, {
      headers: this.getCommonHeaders(),
      params
    });
  }

  parsePeriodo(periodo: string): PeriodoReporte {
    const [anio = '', mes = ''] = periodo.trim().split(/\s+/, 2);
    const meses: Record<string, string> = {
      Enero: '01',
      Febrero: '02',
      Marzo: '03',
      Abril: '04',
      Mayo: '05',
      Junio: '06',
      Julio: '07',
      Agosto: '08',
      Septiembre: '09',
      Septiempre: '09',
      Octubre: '10',
      Noviembre: '11',
      Diciembre: '12'
    };

    return {
      anio,
      mes,
      mesNumero: meses[mes] || ''
    };
  }

  private listarDirectorio(folderName: string): Observable<ReporteArchivo[]> {
    return this.http.get<ReporteArchivo[]>(`${this.documentsUrl}listFilesInDirectory`, {
      params: new HttpParams().set('folderName', folderName)
    });
  }

  private construirFolderReportes(periodo: string, tipoCuentaReporte: TipoCuentaReporte): string {
    const { anio, mesNumero } = this.parsePeriodo(periodo);
    const guidCommerce = this.getStoredValue('guidCommerce')
      || this.getStoredValue('commerceGuid')
      || this.getStoredValue('guid')
      || this.getStoredValue('validate');
    const tipoCuenta = tipoCuentaReporte === 'ADQUIRENTE' ? 'Adquirencia' : 'Emision';

    return `${guidCommerce}/Reportes/${anio}/${mesNumero}/${tipoCuenta}/`;
  }

  private getStoredValue(key: string): string {
    const directValue = localStorage.getItem(key);
    if (directValue) return directValue;

    const sessionRaw = localStorage.getItem('auth_session');
    if (!sessionRaw) return '';

    try {
      const session = JSON.parse(sessionRaw);
      return session?.[key] == null ? '' : String(session[key]);
    } catch {
      return '';
    }
  }
}
