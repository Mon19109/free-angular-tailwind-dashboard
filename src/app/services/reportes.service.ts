import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  buscarFolderReportes(periodo: string, tipoCuenta: TipoCuentaReporte): Observable<ReporteArchivo[]> {
    return this.listarDirectorio(this.construirFolderReportes(periodo, tipoCuenta));
  }

  buscarArchivosReporte(periodo: string, tipoCuenta: TipoCuentaReporte, reporte: string): Observable<ReporteArchivo[]> {
    return this.listarDirectorio(`${this.construirFolderReportes(periodo, tipoCuenta)}${reporte}`);
  }

  obtenerEstadoCuenta(tipo: 'PDF' | 'EXCEL', periodo: string, cuenta: string, clabe = ''): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new URLSearchParams({
      idAffiliationLevel: localStorage.getItem('idRol') || '',
      reportType: tipo,
      month: String(Number(periodoReporte.mesNumero)),
      year: periodoReporte.anio,
      sirioId: cuenta,
      clabe
    });

    return this.http.get(`${this.apiV1Url}account/getAccountStatus?${params.toString()}`, {
      headers: this.getCommonHeaders()
    });
  }

  obtenerCorteDia(periodo: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new URLSearchParams({
      nodeID: localStorage.getItem('nodeID') || '',
      month: String(Number(periodoReporte.mesNumero)),
      year: periodoReporte.anio
    });

    return this.http.get(`${this.apiV1Url}reports/getReportTransactions?${params.toString()}`, {
      headers: this.getCommonHeaders()
    });
  }

  obtenerDiarioTransacciones(periodo: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new URLSearchParams({
      nodeID: localStorage.getItem('nodeID') || '',
      month: String(Number(periodoReporte.mesNumero)),
      year: periodoReporte.anio
    });

    return this.http.get(`${this.apiV1Url}reports/getDailyTransactionReport?${params.toString()}`, {
      headers: this.getCommonHeaders()
    });
  }

  obtenerTransaccionesSplit(periodo: string, cuenta: string): Observable<any> {
    const periodoReporte = this.parsePeriodo(periodo);
    const params = new URLSearchParams({
      account: cuenta,
      month: String(Number(periodoReporte.mesNumero)),
      year: periodoReporte.anio
    });

    return this.http.get(`${this.apiV1Url}reports/getSplitTransactionReport?${params.toString()}`, {
      headers: this.getCommonHeaders()
    });
  }

  parsePeriodo(periodo: string): PeriodoReporte {
    const [anio = '', mes = ''] = periodo.split(' ');
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
    const params = new URLSearchParams({ folderName });

    return this.http.get<ReporteArchivo[]>(`${this.documentsUrl}listFilesInDirectory?${params.toString()}`);
  }

  private construirFolderReportes(periodo: string, tipoCuentaReporte: TipoCuentaReporte): string {
    const { anio, mesNumero } = this.parsePeriodo(periodo);
    const sessionRaw = localStorage.getItem('auth_session');
    let sessionGuid = '';

    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        sessionGuid = session?.guidCommerce || session?.commerceGuid || session?.validate || '';
      } catch {
        sessionGuid = '';
      }
    }

    const guidCommerce = localStorage.getItem('guidCommerce') || localStorage.getItem('commerceGuid') || localStorage.getItem('guid') || sessionGuid;
    const tipoCuenta = tipoCuentaReporte === 'ADQUIRENTE' ? 'Adquirencia' : 'Emision';

    return `${guidCommerce}/Reportes/${anio}/${mesNumero}/${tipoCuenta}/`;
  }
}
