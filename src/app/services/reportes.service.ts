import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly api = '/api/reportes';
  constructor(private http: HttpClient) {}
  obtenerEntidades(): Observable<any> { return this.http.get(`${this.api}/entidades`, { withCredentials: true }); }
  obtenerCuentas(entitySonID?: string): Observable<any> {
    const params = entitySonID === undefined ? undefined : new HttpParams().set('entitySonID', entitySonID);
    return this.http.get(`${this.api}/cuentas`, { params, withCredentials: true });
  }
  obtenerSaldo(idContext: string): Observable<any> {
    return this.http.get(`${this.api}/saldo/${encodeURIComponent(idContext)}`, { withCredentials: true });
  }
  buscarFolderReportes(periodo: string, tipoCuenta: TipoCuentaReporte, guidComerce: string): Observable<ReporteArchivo[]> {
    return this.http.get<ReporteArchivo[]>(`${this.api}/directorio`, { withCredentials: true,
      params: new HttpParams().set('periodo', periodo).set('tipoCuenta', tipoCuenta).set('guidComerce', guidComerce) });
  }
  buscarArchivosReporte(periodo: string, tipoCuenta: TipoCuentaReporte, reporte: string, guidComerce: string): Observable<ReporteArchivo[]> {
    return this.http.get<ReporteArchivo[]>(`${this.api}/archivos`, { withCredentials: true,
      params: new HttpParams().set('periodo', periodo).set('tipoCuenta', tipoCuenta).set('reporte', reporte).set('guidComerce', guidComerce) });
  }
  obtenerEstadoCuenta(tipo: 'PDF' | 'EXCEL', periodo: string, cuenta: string, clabe = ''): Observable<any> {
    return this.http.get(`${this.api}/estado-cuenta`, { withCredentials: true,
      params: new HttpParams().set('tipo', tipo).set('periodo', periodo).set('cuenta', cuenta).set('clabe', clabe) });
  }
  obtenerCorteDia(periodo: string): Observable<any> {
    return this.http.get(`${this.api}/corte-dia`, { withCredentials: true, params: new HttpParams().set('periodo', periodo) });
  }
  obtenerDiarioTransacciones(periodo: string): Observable<any> {
    return this.http.get(`${this.api}/diario-transacciones`, { withCredentials: true, params: new HttpParams().set('periodo', periodo) });
  }
  obtenerTransaccionesSplit(periodo: string, cuenta: string): Observable<any> {
    return this.http.get(`${this.api}/transacciones-split`, { withCredentials: true,
      params: new HttpParams().set('periodo', periodo).set('cuenta', cuenta) });
  }
  parsePeriodo(periodo: string): PeriodoReporte {
    const [anio = '', mes = ''] = periodo.trim().split(/\s+/, 2);
    const meses: Record<string, string> = { Enero:'01', Febrero:'02', Marzo:'03', Abril:'04', Mayo:'05', Junio:'06', Julio:'07', Agosto:'08', Septiembre:'09', Septiempre:'09', Octubre:'10', Noviembre:'11', Diciembre:'12' };
    return { anio, mes, mesNumero: meses[mes] || '' };
  }
}
