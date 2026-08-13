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
  tipoNoti: string;
  tipoPago: string;
  productos?: string[];
  ref1: string;
  ref2: string;
  monto: number | string;
  refCom: string;
  concepto: string;
  fechaVen: string;
  propina: boolean;
  msi: boolean;
}

export interface NotificacionPagoData {
  orderingName: string;
  description: string;
  nameCommerce: string;
  amount: string;
  alphanumericReference: string;
  ticketMessage: string;
  orderingAcount: string;
  commerceId: string;
  dateHourTransaction: string;
  adicional: string;
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
  private crearLink = environment.api.linkpago; // Tu base URLAdquirenciaAdquirencia

  //user: UserSessionData | null = null;

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Bearer '+localStorage.getItem('token'),
      'Content-Type': 'application/json',
      'Entity-i': 'com.onsigna'
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
    headers = headers.set('versionApp', '3');
    
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

  enviarSMS(datos: NotificacionPagoData): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.post(
      `${environment.api.kashpay}api/v1/paymentLink/notification`,
      datos,
      { headers }
    );
  }


  enviarEmail(datos: NotificacionPagoData): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.post(
      `${environment.api.kashpay}api/v1/paymentLink/notification`,
      datos,
      { headers }
    );
  }    

  /**
     * Envía los datos del formulario al API
     * @param formData Datos del formulario
     */
    enviarFormulario(formData: FormularioData): Observable<any> {
      const datosTransformados = {
        messageType: 88,
				user: localStorage.getItem('mail'),
				amount: formData.monto,   
        retrievalReferenceCode: "'.date_timestamp_get($fecha).'",
			  currency: "484",
				sirioId: localStorage.getItem('entitySonID'),
				otherAmount: 0.00,
				orderingAccount : localStorage.getItem('cuenta'),
				payment_type: 1,
        payPhone: formData.tel,
				payEmail: formData.email,
				referenceOne: formData.ref1,
			  referenceTwo: formData.ref2,
				referenceThree: "",
			  customerInfo: {
				  firstName: formData.nombre,
				  lastName: formData.aPaterno,
				  middleName: formData.aMaterno,
				  email: formData.email,
			    phone1: formData.tel   
			  },
				products: formData.productos || [],
				payInfo: {
					unique: true,
					reference: formData.refCom,
					description: formData.concepto,
					response: true,
					expiration: formData.fechaVen,
					urlCallback: "",
			    urlImage: ""
				}
        // Convertir fechas al formato deseado si es necesario
        //fechaInicio: formData.fechaVen ? new Date(formData.fechaVen).toISOString() : null
      };
  
      //getOperations?type_operation='.$_GET['type_operation'].'&id_status='.$_GET['id_status'].'&sirioId='.$_GET['id_context'].'&amount='.$_GET['amount'].'&auth_number='.$_GET['auth_number'].'&num_cuenta='.$_GET['num_cuenta'].'&init_date='.$_GET['init_date'].'&end_date='.$_GET['end_date'].'&email='.$_GET['email'].'&telephoneNumber='.$_GET['telephoneNumber'].'&page='.$pageURL.'&size='.NUM_ITEMS_BY_PAGE;
      //return this.http.get(`${this.baseUrl}processTransaction?type_operation=`);
      return this.http.post(
        `${this.crearLink}/OrderReceiver/api/v1/order`,
        datosTransformados,
        {
          headers: this.getCommonHeaders()
        }
      );
    }

  

}
