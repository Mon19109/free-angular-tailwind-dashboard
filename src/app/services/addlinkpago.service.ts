import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';


export interface FiltrosTransaccion {
  subafiliado?: string;
  entidad?: string;
  sucursal?: string;
  caja?: string;
  operacion?: string;
  monto?: string;
  edoTransaccion?: string;
  referencia?: string;
  autorizacion?: string;
  numTarjeta?: string;
  bin?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface FormularioData {
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  tel: string;
  email: string;
  ref1: string;
  ref2: string;
  monto: number;
  refCom: string;
  concepto: string;
  fechaVen: string;
  propina: boolean;
  msi: boolean;
}

export interface AddLink {
  idOperation: number;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  tel: string;
  email: string;
  ref1: string;
  ref2: string;
  monto: number;
  refCom: string;
  concepto: string;
  fechaVen: string;
  propina: boolean;
  msi: boolean;
    
}


@Injectable({
  providedIn: 'root'
})
export class AddLinkPagoService {
  private http = inject(HttpClient);
  private baseUrl = environment.api.linkpago; // Tu base URLAdquirenciaAdquirencia

  //user: UserSessionData | null = null;

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Bearer '+localStorage.getItem('token'),
      'Content-Type': 'application/json',
      'Entity-i: ': 'com.onsigna'
    });
  }

  /*obtenerTipoNoti(): Observable<any> {
    //const headers = this.getCommonHeaders();
    const headers = new HttpHeaders({
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Entity-i': 'com.onsigna',
      'Content-Type': 'application/json'
    });
    console.log(headers.get('Authorization')); 
    console.log(headers.get('Entity-i')); 
    console.log(headers.get('Content-Type')); 
    return this.http.get(
      `${this.baseUrl}api/v1/order/catalogs/notificationTypes`,
      { headers }
    );
  }*/

  obtenerTipoNoti(): Observable<any> {
    let headers = new HttpHeaders();
    headers = headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    headers = headers.set('Entity-i', 'com.onsigna');
    headers = headers.set('Content-Type', 'application/json');
    
    return this.http.get(
      `${this.baseUrl}order/catalogs/notificationTypes`,
      { headers }
    );
  }
  
  obtenerTipoPago(): Observable<any> {
    let headers = new HttpHeaders();
    headers = headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    headers = headers.set('Entity-i', 'com.onsigna');
    headers = headers.set('Content-Type', 'application/json');

    return this.http.get(
      `${this.baseUrl}order/catalogs/paymentMethods`,
      { headers }
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
        fechaInicio: formData.fechaVen ? new Date(formData.fechaVen).toISOString() : null
      };
  
      //getOperations?type_operation='.$_GET['type_operation'].'&id_status='.$_GET['id_status'].'&sirioId='.$_GET['id_context'].'&amount='.$_GET['amount'].'&auth_number='.$_GET['auth_number'].'&num_cuenta='.$_GET['num_cuenta'].'&init_date='.$_GET['init_date'].'&end_date='.$_GET['end_date'].'&email='.$_GET['email'].'&telephoneNumber='.$_GET['telephoneNumber'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE;
      return this.http.get(`${this.baseUrl}getOperations?type_operation=`);
    }
  

}