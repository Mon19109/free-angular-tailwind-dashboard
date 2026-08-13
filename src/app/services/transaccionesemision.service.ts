import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';


export interface Cuenta {
  id: number;
  nombre: string;
  numero: string;
  saldo?: number;
}

export interface TipoOperacion {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}
export interface Status {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}
export interface FormularioData {
  cuenta?: string;
  idEntidad?: string;
  monto?: number | string;
  montoDesde?: number | string;
  montoHasta?: number | string;
  numAuto?: string;
  email?: string;
  tel?: string;
  estatus?: string;
  tipoOperacion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransaccionesEmisionService {
  private apiAldebaran = environment.api.aldebaran;
  //private cuen = localStorage.getItem('issueId');

  
  constructor(private http: HttpClient) { }

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
    const rawSession = localStorage.getItem('auth_session');

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        if (session?.token) return session.token;
      } catch {
        localStorage.removeItem('auth_session');
      }
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }
  /**
   * Obtiene la lista de cuentas del API
   */

  obtenerCuentas(): Observable<Cuenta[]> {
    //const headers = this.getCommonHeaders();
    
    return this.http.get<any>(`${this.apiAldebaran}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
        
  }

  /**
   * Obtiene la lista de tipos de operación del API
   */
  obtenerTiposOperacion(): Observable<TipoOperacion[]> {
    //return this.http.get<TipoOperacion[]>(`${this.apiUrl}catOperationType/getAll`);
    const headers = this.getBearerHeaders();
    /*const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');


    return this.http.get<any>(`${this.apiAldebaran}catOperationType`, 
      {headers})
     .pipe(
        map(response => response.catOperationTypes) 
        
        // Extraer el arreglo
      );*/

      return this.http.post<any>(`${this.apiAldebaran}catOperationType`, {}, { headers });
    
    
  }


  
  obtenerStatus(): Observable<Status[]> {

    return this.http.get<any>(`${this.apiAldebaran}catStatusOperations`, {
      headers: this.getBearerHeaders()
    });

    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    let params = new HttpParams()
      .set('type_operation', this.emptyParam(formData.tipoOperacion))
      .set('id_status', this.emptyParam(formData.estatus))
      .set('sirioId', this.obtenerSirioId(formData.idEntidad))
      .set('amount', this.emptyParam(formData.monto || formData.montoDesde))
      .set('auth_number', this.emptyParam(formData.numAuto))
      .set('num_cuenta', this.emptyParam(formData.cuenta))
      .set('init_date', this.formatearFechaServicio(formData.fechaInicio))
      .set('end_date', this.formatearFechaServicio(formData.fechaFin))
      .set('email', this.emptyParam(formData.email))
      .set('telephoneNumber', this.emptyParam(formData.tel))
      .set('page', '0')
      .set('size', '10');

    return this.http.get(`${this.apiAldebaran}getOperations`, {
      params,
      headers: this.getBearerHeaders()
    });
  }

  /**
   * Método alternativo para enviar formulario con parámetros query
   * @param formData Datos del formulario
   */
  enviarFormularioComoParams(formData: FormularioData): Observable<any> {
    let params = new HttpParams();
    
    if (formData.cuenta) params = params.set('cuenta', formData.cuenta);
    if (formData.estatus) params = params.set('estatus', formData.estatus);
    if (formData.tipoOperacion) params = params.set('tipoOperacion', formData.tipoOperacion);
    if (formData.fechaInicio) params = params.set('fechaInicio', formData.fechaInicio);
    if (formData.fechaFin) params = params.set('fechaFin', formData.fechaFin);
    
    return this.http.get(`${this.apiAldebaran}/consultas`, { params });
  }

  private emptyParam(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private obtenerSirioId(idEntidad: unknown): string {
    return this.normalizarSirioId(idEntidad)
      || localStorage.getItem('issueId')
      || localStorage.getItem('entitySonID')
      || '';
  }

  private normalizarSirioId(value: unknown): string {
    return this.emptyParam(value).trim();
  }

  private formatearFechaServicio(value: unknown): string {
    const fecha = this.emptyParam(value).trim();
    return fecha ? fecha.split(' ')[0] : '';
  }

}
