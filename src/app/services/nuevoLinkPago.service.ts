import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EditarLinkPagoResponse {
  success?: boolean;
  message?: string;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class NuevoLinkPagoService {
  private readonly http = inject(HttpClient);
  private readonly bff = '/api/nuevo-link-pago';
  private readonly options = { withCredentials: true };

  obtenerLink(referencia: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.bff}/order/${encodeURIComponent(referencia)}`, this.options);
  }

  obtenerTiposNotificacion(): Observable<unknown> {
    return this.http.get<unknown>(`${this.bff}/catalogs/notificationTypes`, this.options);
  }

  obtenerMetodosPago(): Observable<unknown> {
    return this.http.get<unknown>(`${this.bff}/catalogs/paymentMethods`, this.options);
  }

  editarLink(formData: any, productos: string[]): Observable<EditarLinkPagoResponse> {
    const monto = Number(String(formData.monto ?? '0').replace(/,/g, ''));
    const fechaVencimiento = String(formData.fechaVencimiento || '').split('T')[0];
    const urlImage = `${window.location.origin}/public/assets/img/logos_pagos/comercio_default.png`;
    const payload = {
      id: String(formData.id || ''),
      amount: monto,
      notificationType: { notificationTypeID: Number(formData.tipoNotificacion) },
      paymentMethod: { paymentMethodID: Number(formData.metodoPago) },
      orderType: { id: Number(formData.orderType) },
      status: { statusID: Number(formData.statusID) },
      products: productos.map(description => ({ description, category: '', count: 0, price: 0.0, tax: 0.0 })),
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
    return this.http.put<EditarLinkPagoResponse>(`${this.bff}/order`, payload, this.options);
  }
}
