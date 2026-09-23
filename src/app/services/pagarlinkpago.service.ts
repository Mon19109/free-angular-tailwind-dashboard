import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../environments/environments';

export interface UbicacionPago {
  latitud: string;
  longitud: string;
}

export interface AltaTarjeta {
  firstName: string;
  lastName: string;
  email: string;
  postalCode: string;
  address: string;
  locality: string;
  country: string;
  number: string;
  expirationMonth: string;
  expirationYear: string;
  merchantCustomerID: string;
}

@Injectable({ providedIn: 'root' })
export class PagarLinkPagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.linkpago;
  private readonly transactionUrl = environment.api.voucher;
  // Equivale a WS_CARDS + CTXT_CARDS del servicio anterior.
  private readonly cardsUrl = '/CardsServices/api/v1/';
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

  private get cardsHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.bearerToken}`,
      'Entity-i': 'com.onsigna',
      versionApp: '3'
    });
  }

  agregarTarjeta(tarjeta: AltaTarjeta): Observable<any> {
    return this.http.post(`${this.cardsUrl}tokenization/add`, {
      enrollmentRequest: {
        orderInformation: {
          billTo: {
            firstName: tarjeta.firstName,
            lastName: tarjeta.lastName,
            email: tarjeta.email,
            postalCode: tarjeta.postalCode,
            address1: tarjeta.address,
            locality: tarjeta.locality,
            country: tarjeta.country
          }
        },
        paymentInformation: {
          card: {
            number: tarjeta.number.replace(/\D/g, ''),
            expirationMonth: tarjeta.expirationMonth,
            expirationYear: tarjeta.expirationYear
          }
        }
      },
      customerRequest: {
        buyerInformation: { merchantCustomerID: tarjeta.merchantCustomerID }
      }
    }, { headers: this.cardsHeaders });
  }

  obtenerDetalleTarjeta(merchanID: string, cardToken: string): Observable<any> {
    const params = new HttpParams().set('merchanID', merchanID).set('cardToken', cardToken);
    return this.http.get(`${this.cardsUrl}tokenization/getTokenDetail`, { headers: this.cardsHeaders, params });
  }

  obtenerCliente(customerIdentifier: string): Observable<any> {
    const params = new HttpParams().set('customerIdentifier', customerIdentifier);
    return this.http.get(`${this.cardsUrl}customer`, { headers: this.cardsHeaders, params });
  }

  obtenerTarjetas(merchanID: string): Observable<any> {
    const params = new HttpParams().set('merchanID', merchanID);
    return this.http.get(`${this.cardsUrl}tokenization/getTokens`, { headers: this.cardsHeaders, params });
  }

  obtenerOrden(referencia: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.bearerToken}`,
      'Entity-i': 'com.onsigna',
      'versionApp': '3',
      'Content-Type': 'application/json'
    });
    return this.http.get(`${this.apiUrl}order/${referencia}`, { headers });
  }

  validarBin(bin: string, amount: number): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.bearerToken}`,
      'Entity-i': 'com.onsigna',
      'versionApp': '3',
      'Content-Type': 'application/json'
    });
    const params = new HttpParams()
      .set('bin', bin)
      .set('amount', String(amount));

    return this.http.get(`${this.apiUrl}order/catalogs/msi`, { headers, params });
  }

  procesarTransaccion(payload: Record<string, unknown>): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.bearerToken}`,
      'Content-Type': 'application/json'
    });

    return this.obtenerUbicacion().pipe(
      switchMap(ubicacion => {
        const itInformation = payload['itInformation'];
        const informacionDispositivo = typeof itInformation === 'object' && itInformation !== null
          ? itInformation
          : {};

        const payloadConUbicacion = {
          ...payload,
          itInformation: {
            ...informacionDispositivo,
            latitude: ubicacion.latitud,
            longitude: ubicacion.longitud
          }
        };

        return this.http.post(
          `${this.transactionUrl}processTransaction`,
          payloadConUbicacion,
          { headers }
        );
      })
    );
  }

  obtenerUbicacion(): Observable<UbicacionPago> {
    return new Observable<UbicacionPago>(observer => {
      if (!navigator.geolocation) {
        observer.next({ latitud: '', longitud: '' });
        observer.complete();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        posicion => {
          observer.next({
            latitud: String(posicion.coords.latitude),
            longitud: String(posicion.coords.longitude)
          });
          observer.complete();
        },
        () => {
          observer.next({ latitud: '', longitud: '' });
          observer.complete();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }
}
