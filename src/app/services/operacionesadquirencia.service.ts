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
  cuenta: string;
  idEntidad: string;
  idSucursal: string;
  idSubafiliado: string;
  idCaja: string;
  monto: number;
  numAuto: string;
  email: string;
  tel: string;
  estatus: string;
  tipoOperacion: string;
  fechaInicio: string;
  fechaFin: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperacionesAdquirenciaService {
  private apiAldebaran = environment.api.aldebaran;
  private baseUrl = environment.api.kashpay;
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
    const headers = this.getCommonHeaders();
    return this.http.post<any>(`${this.baseUrl}catOperationType/getAll`, { 
      headers: headers,
      withCredentials: true
    }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta operatipo:', response))
    );
    
    
  }

  getSubafiliados(): Observable<{ contextResponse: Subafiliado[] }> {
      return this.http.get<{ contextResponse: Subafiliado[] }>(
        `${this.baseUrl}subAffiliation/getAll`
      );
    }
  
    getSubafiliadoById(id: number): Observable<{ contextResponse: Subafiliado }> {
      return this.http.get<{ contextResponse: Subafiliado }>(
        `${this.baseUrl}subAffiliation/getById?idSubAffiliation=${id}`
      );
    }
  
    /*getSubafiliados(): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/getSubafiliados`);
    }*/
  
    getEntidades(subafiliadoId: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/searchEntidad/${subafiliadoId}`);
    }
  
    getSucursales(subafiliadoId: number, entidadId: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/searchSucursal/${subafiliadoId}/${entidadId}`);
    }
  
    getCajas(idTerminal: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/searchCaja/${idTerminal}`);
    }
  
  obtenerStatus(): Observable<Status[]> {

    return this.http.get<any>(`${this.apiAldebaran}catStatusOperations`);

    
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

    //getOperations?type_operation='.$_GET['type_operation'].'&id_status='.$_GET['id_status'].'&sirioId='.$_GET['id_context'].'&amount='.$_GET['amount'].'&auth_number='.$_GET['auth_number'].'&num_cuenta='.$_GET['num_cuenta'].'&init_date='.$_GET['init_date'].'&end_date='.$_GET['end_date'].'&email='.$_GET['email'].'&telephoneNumber='.$_GET['telephoneNumber'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE;
    return this.http.get(`${this.apiAldebaran}getOperations?type_operation=${formData.tipoOperacion}&id_status=${formData.estatus}&sirioId=${formData.idEntidad}&amount=${formData.monto}&auth_number=${formData.numAuto}&num_cuenta=${formData.cuenta}&init_date=${formData.fechaInicio}&end_date=${formData.fechaFin}&email=${formData.email}&telephoneNumber=${formData.tel}&page=0&size=10`);
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
}