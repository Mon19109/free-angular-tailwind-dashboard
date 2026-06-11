import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
import { AuthService, UserSessionData } from '../services/auth.service';


export interface Entidad {
  bundle: number;
  bussinesName: string;
}


export interface FormularioData {
  entidad: string;
  typeSearch: string;
  value1F: string;
  value2F: string;
  size: number;
  pages: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
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

  obtenerEntidades(): Observable<any[]> {

    return this.http.get<any[]>(
      `${this.apiAldebaran}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`
    );

  }


  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  /* enviarFormulario(formData: FormularioData): Observable<any> {
     let value1;
     let value2;
 
     if (formData.typeSearch == '0'){
       value1 = formData.value1F ? new Date(formData.value1F).toISOString() : null;
       value2= formData.value2F ? new Date(formData.value2F).toISOString() : null
     }else{
       value1 = formData.value1F;
       value2 = '';
     }
     // Opcional: Puedes transformar los datos si es necesario
     const datosTransformados = {
       ...formData,
       // Convertir fechas al formato deseado si es necesario
       
       value1F: value1,
       value2F: value2
     };
 
     //getOperations?type_operation='.$_GET['type_operation'].'&id_status='.$_GET['id_status'].'&sirioId='.$_GET['id_context'].'&amount='.$_GET['amount'].'&auth_number='.$_GET['auth_number'].'&num_cuenta='.$_GET['num_cuenta'].'&init_date='.$_GET['init_date'].'&end_date='.$_GET['end_date'].'&email='.$_GET['email'].'&telephoneNumber='.$_GET['telephoneNumber'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE;
     //getUsersBy?sirioId='.$_GET['id_context'].'&type='.$_GET['type'].'&value1='.$_GET['value1'].'&value2='.$_GET['value2'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGEgetUsersBy?sirioId='.$_GET['id_context'].'&type='.$_GET['type'].'&value1='.$_GET['value1'].'&value2='.$_GET['value2'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE
    // return this.http.get(`${this.apiAldebaran}getUsersBy?sirioId==${formData.entidad}&type=${formData.typeSearch}&value1=${formData.value1F}&value2=${formData.value2F}&page=1&size=10`);
     return this.http.get(`${this.apiAldebaran}getUsersBy?sirioId=${formData.entidad}&type=${formData.typeSearch}&value1=${formData.value1F}&value2=${formData.value2F}&page=1&size=10`);
   
   }*/
  enviarFormulario(
    formData: FormularioData,
    page: number = 1
  ): Observable<any> {

    let value1 = formData.value1F;
    let value2 = '';

    if (formData.typeSearch === '0') {

      value1 = formData.value1F;
      value2 = formData.value2F;

    }

    if (formData.typeSearch === '3') {

      value2 = 'na';

    }

    const url =
      `${this.apiAldebaran}getUsersBy` +
      `?sirioId=${formData.entidad}` +
      `&type=${formData.typeSearch}` +
      `&value1=${value1}` +
      `&value2=${value2}` +
      `&page=${page}&size=10`;

    console.log('URL');
    console.log(url);

    return this.http.get(url);

  }

  /**
   * Método alternativo para enviar formulario con parámetros query
   * @param formData Datos del formulario
   */
  enviarFormularioComoParams(formData: FormularioData): Observable<any> {
    let params = new HttpParams();

    if (formData.entidad) params = params.set('cuenta', formData.entidad);
    if (formData.typeSearch) params = params.set('typeSearch', formData.typeSearch);
    if (formData.value1F) params = params.set('value1', formData.value1F);
    if (formData.value2F) params = params.set('value2', formData.value2F);

    //return this.http.get(`${this.apiAldebaran}/consultas`, { params });
    return this.http.get(`${this.apiAldebaran}getUsersBy?sirioId=${formData.entidad}&type=${formData.typeSearch}&value1=${formData.value1F}&value2=${formData.value2F}&page=1&size=10`);

  }
}