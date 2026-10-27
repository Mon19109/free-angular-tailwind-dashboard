import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private readonly sessionAuth = inject(AuthService);
  private http = inject(HttpClient);
  private baseUrl = '/api/addlinkpago/'; // Tu base URLAdquirenciaAdquirencia
  private crearLink = '/api/addlinkpago/'; // Tu base URLAdquirenciaAdquirencia

  //user: UserSessionData | null = null;

  obtenerTipoNoti(): Observable<any> {
    return this.http.get(`${this.baseUrl}notificationTypes`);
  }

  obtenerTipoPago(): Observable<any> {
    return this.http.get(`${this.baseUrl}paymentMethods`);
  }

  enviarSMS(datos: NotificacionPagoData): Observable<any> {
    return this.http.post(`${this.baseUrl}notification/sms`, datos);
  }

  enviarEmail(datos: NotificacionPagoData): Observable<any> {
    return this.http.post(`${this.baseUrl}notification/email`, datos);
  }

  /**
     * Envía los datos del formulario al API
     * @param formData Datos del formulario
     */
    enviarFormulario(formData: FormularioData): Observable<any> {
      const productos = (formData.productos || []).map(description => ({
        description,
        category: '',
        count: 0,
        price: 0.0,
        tax: 0.0
      }));

      const fechaVenNormalizada = formData.fechaVen.trim().replace(/\s+/, 'T');
      const expiration = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaVenNormalizada)
        ? `${fechaVenNormalizada}:59`
        : fechaVenNormalizada;

      const datosTransformados = {
        user: this.sessionAuth.getSessionValue('mail') || '',
        amount: Number(String(formData.monto ?? '').replace(/,/g, '')),
        sirioID: this.sessionAuth.getSessionValue('entitySonID') || '',
        paymentType: 1,
        retrievalReferenceCode: String(Math.floor(Date.now() / 1000)),
        currency: '484',
        notificationType: {
          notificationTypeID: Number(formData.tipoNoti)
        },
        paymentMethod: {
          paymentMethodID: Number(formData.tipoPago)
        },
        orderType: {
          id: 2
        },
        products: productos,
        customerInfo: {
          firstName: formData.nombre,
          lastName: formData.aPaterno,
          middleName: formData.aMaterno,
          email: formData.email,
          phone1: formData.tel
        },
        payInfo: {
          reference: formData.refCom,
          description: formData.concepto,
          expiration,
          urlCallback: '',
          urlImage: ''
        },
        otherAmount: 0.0,
        orderingAccount: this.sessionAuth.getSessionValue('cuenta') || '',
        payPhone: formData.tel,
        payEmail: formData.email,
        referenceOne: formData.ref1,
        referenceTwo: formData.ref2,
        referenceThree: '',
        tip: formData.propina,
        msi: formData.msi
      };

      /* console.log('datosTransformados::',datosTransformados); */

      return this.http.post(
        `${this.crearLink}order`,
        datosTransformados
      );
    }

  

}
