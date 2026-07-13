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
    return this.http.get<any>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
     //return this.http.get<any>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('entitySonID')}&level=`);
    

    //return this.http.get<Cuenta[]>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
  }


obtenerConcentratorAccounts(): Observable<any> {

  const headers = new HttpHeaders({
    Authorization: 'Basic YWRtaW46c2VjcmV0'
  });

  return this.http.get<any>(
    `${this.apiV1Url}account/getConcentratorAccounts?sirioId=${localStorage.getItem('entitySonID')}`,
    { headers }
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
    //const headers = this.getCommonHeaders();
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');


    return this.http.get<any>(`${this.apiV1Url}catOperationType/getAll`, 
      {headers})
     .pipe(
        map(response => response.catOperationTypes) 
        
        // Extraer el arreglo
      );
    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    // Opcional: Puedes transformar los datos si es necesario
    const datosTransformados = {
      ...formData,
      // Convertir fechas al formato deseado si es necesario
      fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio).toISOString() : null,
      fechaFin: formData.fechaFin ? new Date(formData.fechaFin).toISOString() : null
    };

    //$urlServices =WS_SALDOS.
    // '/Entities/entities/'.$_GET['entidad'].'/getoperationbytypeandstatuscustom?type='.$_GET['type'].'&status='.$_GET['status'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE.'&dateInit='.$location.'&dateFinish='.$location2;
    
    return this.http.get(`${this.apiUrlOpe}${localStorage.getItem('issueId') }/getoperationbytypeandstatuscustom?type=${formData.tipoOperacion}&status=${formData.estatus}&page=0&size=10&dateInit=${formData.fechaInicio}&dateFinish=${formData.fechaFin}`);
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
