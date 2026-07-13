import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
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
    const headers = this.getCommonHeaders();
    /*const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');


    return this.http.get<any>(`${this.apiAldebaran}catOperationType`, 
      {headers})
     .pipe(
        map(response => response.catOperationTypes) 
        
        // Extraer el arreglo
      );*/

      return this.http.post<any>(`${this.apiAldebaran}catOperationType`, { 
          headers: headers,
          withCredentials: true
        }).pipe(
          //timeout(30000),
          tap(response => console.log('Respuesta login:', response))
        );
    
    
  }


  
  obtenerStatus(): Observable<Status[]> {

    return this.http.get<any>(`${this.apiAldebaran}catStatusOperations`);

    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    const params = new HttpParams()
      .set('type_operation', this.emptyParam(formData.tipoOperacion))
      .set('id_status', this.emptyParam(formData.estatus))
      .set('amount', this.emptyParam(formData.monto))
      .set('auth_number', this.emptyParam(formData.numAuto))
      .set('num_cuenta', this.emptyParam(formData.cuenta))
      .set('init_date', this.emptyParam(formData.fechaInicio))
      .set('end_date', this.emptyParam(formData.fechaFin))
      .set('page', '0')
      .set('size', '10');

    return this.http.get(`${this.apiAldebaran}getOperations`, { params });
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
}
