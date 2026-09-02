import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface LinkNegocioFormData {
  emailComer: string;
  monto: number | string;
  sirio: string;
  nombre: string;
  apaterno: string;
  amaterno: string;
  email: string;
  telefono: string;
  orderingAccount: string;
  concepto: string;
}

export interface AddLinkNegocioResponse<T = any> {
  rows: T;
}

@Injectable({ providedIn: 'root' })
export class LinkNegocioService {
  private readonly http = inject(HttpClient);
  private readonly orderUrl = `${environment.api.linkpago}order`;

  addLink(formData: LinkNegocioFormData): Observable<AddLinkNegocioResponse> {
    const monto = Number(String(formData.monto ?? '0').replace(/[$,\s]/g, ''));
    const expiration = `${this.getExpirationDate()}T23:59:59`;
    const reference = this.generateNumericReference();
    const urlImage = `${window.location.origin}/pagosDistancia/tienda.png`;

    const payload = {
      user: formData.emailComer,
      amount: monto,
      sirioID: formData.sirio,
      paymentType: 1,
      retrievalReferenceCode: String(Math.floor(Date.now() / 1000)),
      currency: '484',
      notificationType: {
        notificationTypeID: 1
      },
      paymentMethod: {
        paymentMethodID: 3
      },
      orderType: {
        id: 3
      },
      products: [],
      customerInfo: {
        firstName: formData.nombre,
        lastName: formData.apaterno,
        middleName: formData.amaterno,
        email: formData.email,
        phone1: formData.telefono
      },
      payInfo: {
        reference,
        description: formData.concepto,
        expiration,
        urlCallback: '',
        urlImage
      },
      otherAmount: 0,
      orderingAccount: formData.orderingAccount,
      payPhone: formData.telefono,
      payEmail: formData.email,
      referenceOne: '',
      referenceTwo: '',
      referenceThree: ''
    };

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.getStoredToken()}`,
      'Entity-i': 'com.onsigna',
      versionApp: '3',
      'Content-Type': 'application/json'
    });

    return this.http.post(this.orderUrl, payload, { headers }).pipe(
      map(response => ({ rows: response }))
    );
  }

  private getExpirationDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private generateNumericReference(): string {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
  }

  private getStoredToken(): string {
    const rawSession = localStorage.getItem('auth_session');

    if (rawSession) {
      try {
        const token = JSON.parse(rawSession)?.token;
        if (token) return String(token);
      } catch {
        // Si la sesión no es válida, se consulta el token individual.
      }
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }
}
