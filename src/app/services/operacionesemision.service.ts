import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';

export interface FiltrosDetalleLiquidacion {
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
}

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

export interface FormularioData {
  cuenta: string;
  estatus: string;
  tipoOperacion: string;
  fechaInicio: string;
  fechaFin: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperacionesEmisionService {
  private apiUrl = environment.api.kashpay; // Reemplazar con tu URL base
  private apiV1Url = `${this.apiUrl}api/v1/`;
  private apiUrlCuentas = environment.api.aldebaran;
  private apiUrlOpe = environment.api.saldos; // Reemplazar con tu URL base
  //private cuen = localStorage.getItem('issueId');

  
  constructor(private http: HttpClient) { }

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
    return this.http.get<any>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
     //return this.http.get<any>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('entitySonID')}&level=`);
    

    //return this.http.get<Cuenta[]>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
  }


obtenerConcentratorAccounts(): Observable<any> {
  return this.http.get<any>(
    `${this.apiV1Url}account/getConcentratorAccounts?sirioId=${localStorage.getItem('entitySonID')}`,
    { headers: this.getBearerHeaders() }
  );
}

  

  /**
   * Obtiene las entidades 
   */
obtenerEntidades(cuenta: string): Observable<any> {

  console.log(
    `${this.apiUrlCuentas}getEntityLevels?fatherId=${cuenta}&level=`
  );

  return this.http.get<any>(
    `${this.apiUrlCuentas}getEntityLevels?fatherId=${cuenta}&level=`
  );
}






  /**
   * Obtiene la lista de tipos de operación del API
   */
  obtenerTiposOperacion(): Observable<TipoOperacion[]> {
    //return this.http.get<TipoOperacion[]>(`${this.apiUrl}catOperationType/getAll`);
    const headers = this.getBearerHeaders();


    return this.http.get<any>(`${this.apiV1Url}catOperationType/getAll`, 
      {headers})
     .pipe(
        map(response => response.catOperationTypes) 
        
        // Extraer el arreglo
      );
    
  }


  obtenerDetalleOperacion(validate: string, filtros: FiltrosDetalleLiquidacion = {}): Observable<any> {
    // Mismo contrato de búsqueda usado por Transacciones Adquirencia.
    const params = new HttpParams()
      .set('userID', localStorage.getItem('idUser') || '')
      .set('rootNodeID', localStorage.getItem('nodeID') || '')
      .set('liquidationID', validate.trim())
      .set('typeOperation', filtros.type || '10008')
      .set('type', filtros.type || '10008')
      .set('amount', '')
      .set('amountFrom', '')
      .set('amountTo', '')
      .set('email', '')
      .set('responseCode', '')
      .set('startDate', filtros.startDate || '')
      .set('endDate', filtros.endDate || '')
      .set('page', '')
      .set('status', filtros.status || '')
      .set('searchBy', '');

    return this.http.get<any>(`${this.apiV1Url}operations/searchOperations`, {
      headers: this.getBearerHeaders(),
      params
    });
  }


  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData, page = 0): Observable<any> {
    const cuenta = formData.cuenta || localStorage.getItem('issueId') || '';
    const params = new HttpParams()
      .set('type', String(formData.tipoOperacion ?? ''))
      .set('status', String(formData.estatus ?? ''))
      .set('page', page).set('size', 10)
      .set('dateInit', formData.fechaInicio || '')
      .set('dateFinish', formData.fechaFin || '');
    return this.http.get<any>(`${this.apiUrlOpe}${encodeURIComponent(cuenta)}/getoperationbytypeandstatuscustom`, {
      headers: this.getBearerHeaders(), params
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
    
    return this.http.get(`${this.apiUrl}/consultas`, { params });
  }
}
