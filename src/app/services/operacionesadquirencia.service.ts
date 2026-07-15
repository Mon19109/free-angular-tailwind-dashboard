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

export interface Subafiliado {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Entidad {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Sucursal {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Caja {
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
  entidad?: string;
  sucursal?: string;
  caja?: string;
  clasificacion?: string;
  idEntidad?: string;
  idSucursal?: string;
  idSubafiliado?: string;
  idCaja?: string;
  monto?: number | string;
  numAuto?: string;
  email?: string;
  tel?: string;
  estatus?: string | string[];
  tipoOperacion?: string | string[];
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperacionesAdquirenciaService {
  private apiAldebaran = environment.api.aldebaran;
  private baseUrl = environment.api.kashpay;
  private apiV1Url = `${this.baseUrl}api/v1/`;
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

  /*obtenerCuentas(): Observable<Cuenta[]> {
    //const headers = this.getCommonHeaders();
    
    return this.http.get<any>(`${this.apiAldebaran}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
        
  }*/




  obtenerCuentas(): Observable<Cuenta[]> {

  return this.http.get<any>(
    `${this.apiAldebaran}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`
  ).pipe(
    tap(resp => console.log('CUENTAS API:', resp))
  );

}

  /**
   * Obtiene la lista de tipos de operación del API
   */
  /*obtenerTiposOperacion(): Observable<TipoOperacion[]> {
    const headers = this.getCommonHeaders();
    return this.http.post<any>(`${this.baseUrl}catOperationType/getAll`, { 
      headers: headers,
      withCredentials: true
    }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta operatipo:', response))
    );
    
    
  }*/

    obtenerTiposOperacion(): Observable<any> {

  const headers = this.getCommonHeaders();

  return this.http.get<any>(
    `${this.apiV1Url}catOperationType/getAll`,
    {
      headers
    }
  );

}

  getSubafiliados(): Observable<{ contextResponse: Subafiliado[] }> {
      return this.http.get<{ contextResponse: Subafiliado[] }>(
        `${this.apiV1Url}subAffiliation/getAll`
      );
    }
  
    getSubafiliadoById(id: number): Observable<{ contextResponse: Subafiliado }> {
      return this.http.get<{ contextResponse: Subafiliado }>(
        `${this.apiV1Url}subAffiliation/getById?idSubAffiliation=${id}`
      );
    }
  
    /*getSubafiliados(): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/getSubafiliados`);
    }*/
  
    /*getEntidades(subafiliadoId: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/searchEntidad/${subafiliadoId}`);
    }*/
  getEntidades(subafiliadoId: number): Observable<any> {

  return this.http.get(
    `${this.apiV1Url}entity/getEntitiesBySubAffiliation?idSubAffiliation=${subafiliadoId}`,
    {
      headers: this.getCommonHeaders()
    }
  );

}
  
    getSucursales(subafiliadoId: number, entidadId: number): Observable<any> {
      return this.http.get(
        `${this.apiV1Url}branchOffice/getBranchOfficeByAffiliationAndEntity?idSubAffiliation=${subafiliadoId}&idEntity=${entidadId}`,
        { headers: this.getCommonHeaders() }
      );
    }
  
    getCajas(idTerminal: number): Observable<any> {
      return this.http.get(
        `${this.apiV1Url}collaborator/getCollaboratorByBranchOffice?idTerminal=${idTerminal}`,
        { headers: this.getCommonHeaders() }
      );
    }
//ESE SERVCIO ES DE PHP 
/*getSucursales(subafiliadoId:number, entidadId:number) {
  return this.http.get(
    `${this.baseUrl}branchOffice/getBranchOfficeByAffiliationAndEntity?idSubAffiliation=${subafiliadoId}&idEntity=${entidadId}`,
    { headers: this.getCommonHeaders() }
  );
}

getCajas(idTerminal:number) {
  return this.http.get(
    `${this.baseUrl}collaborator/getCollaboratorByBranchOffice?idTerminal=${idTerminal}`,
    { headers: this.getCommonHeaders() }
  );
}
*/





  obtenerStatus(): Observable<Status[]> {

    return this.http.get<any>(`${this.apiAldebaran}catStatusOperations`);

    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    const sirioId = formData.caja || formData.sucursal || formData.entidad || formData.idEntidad || formData.cuenta;

    const params = new HttpParams()
      .set('type_operation', this.emptyParam(formData.tipoOperacion))
      .set('id_status', this.emptyParam(formData.estatus))
      .set('sirioId', this.emptyParam(sirioId))
      .set('amount', this.emptyParam(formData.monto))
      .set('auth_number', this.emptyParam(formData.numAuto))
      .set('num_cuenta', this.emptyParam(formData.cuenta))
      .set('init_date', this.emptyParam(formData.fechaInicio))
      .set('end_date', this.emptyParam(formData.fechaFin))
      .set('email', this.emptyParam(formData.email))
      .set('telephoneNumber', this.emptyParam(formData.tel))
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
    if (formData.estatus) params = params.set('estatus', this.emptyParam(formData.estatus));
    if (formData.tipoOperacion) params = params.set('tipoOperacion', this.emptyParam(formData.tipoOperacion));
    if (formData.fechaInicio) params = params.set('fechaInicio', formData.fechaInicio);
    if (formData.fechaFin) params = params.set('fechaFin', formData.fechaFin);
    
    return this.http.get(`${this.apiAldebaran}/consultas`, { params });
  }

  private emptyParam(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  }
}
