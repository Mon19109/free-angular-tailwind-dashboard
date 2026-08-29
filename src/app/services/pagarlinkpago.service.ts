import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../environments/environments';

export interface UbicacionPago {
  latitud: string;
  longitud: string;
}

@Injectable({ providedIn: 'root' })
export class PagarLinkPagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.linkpago;
  private readonly transactionUrl = environment.api.voucher;
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

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
