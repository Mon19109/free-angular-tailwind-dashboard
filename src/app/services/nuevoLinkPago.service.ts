import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class NuevoLinkPagoService {
  private readonly apiUrl = environment.api.linkpago;

  constructor(private http: HttpClient) { }

  obtenerLink(referencia: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}order/${encodeURIComponent(referencia)}`,
      { headers: this.getHeaders() }
    );
  }

  obtenerTiposNotificacion(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}order/catalogs/notificationTypes`,
      { headers: this.getHeaders() }
    );
  }

  obtenerMetodosPago(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}order/catalogs/paymentMethods`,
      { headers: this.getHeaders() }
    );
  }

  editarLink(formData: any, productos: string[]): Observable<any> {
    const monto = Number(String(formData.monto ?? '0').replace(/,/g, ''));
    const fechaVencimiento = String(formData.fechaVencimiento || '').split('T')[0];
    const urlImage = `${window.location.origin}/public/assets/img/logos_pagos/comercio_default.png`;

    const payload = {
      id: String(formData.id || ''),
      amount: monto,
      notificationType: {
        notificationTypeID: Number(formData.tipoNotificacion)
      },
      paymentMethod: {
        paymentMethodID: Number(formData.metodoPago)
      },
      orderType: {
        id: Number(formData.orderType)
      },
      status: {
        statusID: Number(formData.statusID)
      },
      products: productos.map(description => ({
        description,
        category: '',
        count: 0,
        price: 0.0,
        tax: 0.0
      })),
      customerInfo: {
        firstName: String(formData.nombre || ''),
        lastName: String(formData.apellidoPaterno || ''),
        middleName: String(formData.apellidoMaterno || ''),
        email: String(formData.email || ''),
        phone1: String(formData.tel || '')
      },
      payInfo: {
        reference: String(formData.referenciaComercio || ''),
        description: String(formData.concepto || ''),
        expiration: `${fechaVencimiento}T23:59:59`,
        urlCallback: '',
        urlImage
      },
      referenceOne: String(formData.referenciaUno || ''),
      referenceTwo: String(formData.referenciaDos || ''),
      paymentType: 1,
      referenceThree: '',
      tip: Boolean(formData.propina),
      msi: Boolean(formData.msi)
    };

    return this.http.put(
      `${this.apiUrl}order`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'versionApp': '3',
      'Entity-i': 'com.onsigna',
      'Content-Type': 'application/json'
    });
  }
}
