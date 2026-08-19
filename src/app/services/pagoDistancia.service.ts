import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export type FiltroPagoDistancia =
  | 'Apellido Paterno'
  | 'Apellido Materno'
  | 'Nombre'
  | 'Concepto'
  | 'Correo Electrónico'
  | 'Monto'
  | 'Referencia del comercio'
  | 'Teléfono'
  | 'Fecha de expiración'
  | '';

export interface BusquedaPagoDistanciaData {
  filtro: FiltroPagoDistancia;
  busqueda: string;
  fechaCreacion: string;
}

interface CustomerInfoBusqueda {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone1: string;
}

interface PayInfoBusqueda {
  reference: string;
  description: string;
  creation: string;
  expiration: string;
}

@Injectable({
  providedIn: 'root'
})
export class PagoDistanciaService {
  private readonly apiUrl = environment.api.linkpago;

  constructor(private http: HttpClient) { }

  buscarOrdenes(formData: BusquedaPagoDistanciaData): Observable<any> {
    const customerInfo: CustomerInfoBusqueda = {
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phone1: ''
    };
    const payInfo: PayInfoBusqueda = {
      reference: '',
      description: '',
      creation: formData.fechaCreacion,
      expiration: ''
    };
    let amount: number | null = null;

    switch (formData.filtro) {
      case 'Apellido Paterno':
        customerInfo.lastName = formData.busqueda;
        break;
      case 'Apellido Materno':
        customerInfo.middleName = formData.busqueda;
        break;
      case 'Nombre':
        customerInfo.firstName = formData.busqueda;
        break;
      case 'Concepto':
        payInfo.description = formData.busqueda;
        break;
      case 'Correo Electrónico':
        customerInfo.email = formData.busqueda;
        break;
      case 'Monto': {
        const monto = Number(formData.busqueda);
        amount = Number.isFinite(monto) ? monto : null;
        break;
      }
      case 'Referencia del comercio':
        payInfo.reference = formData.busqueda;
        break;
      case 'Teléfono':
        customerInfo.phone1 = formData.busqueda;
        break;
      case 'Fecha de expiración':
        payInfo.expiration = formData.busqueda;
        break;
      default:
        customerInfo.firstName = formData.busqueda;
        break;
    }

    const payload = {
      sirioID: localStorage.getItem('entitySonID') || '',
      amount,
      customerInfo,
      payInfo
    };

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'Entity-i': 'com.onsigna',
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.post(
      `${this.apiUrl}order/getOders`,
      payload,
      { headers }
    );
  }
}
