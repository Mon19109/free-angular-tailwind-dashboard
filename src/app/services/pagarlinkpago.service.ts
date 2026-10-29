import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, switchMap } from 'rxjs';


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
  private readonly bff = '/api/pagar-voucher';
  private ubicacionPrecargada?: Observable<UbicacionPago>;

  agregarTarjeta(tarjeta: AltaTarjeta): Observable<any> {
    return this.http.post(`${this.bff}/tarjetas`, tarjeta, { withCredentials: true });
  }

  obtenerDetalleTarjeta(merchanID: string, cardToken: string): Observable<any> {
    return this.http.get(`${this.bff}/tarjetas/detalle`, {
      params: new HttpParams().set('merchanID', merchanID).set('cardToken', cardToken), withCredentials: true
    });
  }

  obtenerCliente(customerIdentifier: string): Observable<any> {
    return this.http.get(`${this.bff}/cliente`, { params: { customerIdentifier }, withCredentials: true });
  }

  obtenerTarjetas(merchanID: string): Observable<any> {
    return this.http.get(`${this.bff}/tarjetas`, { params: { merchanID }, withCredentials: true });
  }

  obtenerIp(): Observable<{ ip: string }> {
    return this.http.get<{ ip: string }>('https://api.ipify.org?format=json');
  }

  obtenerOrden(referencia: string): Observable<any> {
    return this.http.get(`${this.bff}/orden/${encodeURIComponent(referencia)}`, { withCredentials: true });
  }

  obtenerBalance(sirioId: string): Observable<any> {
    return this.http.get(`${this.bff}/balance/${encodeURIComponent(sirioId)}`, { withCredentials: true });
  }

  validarBin(bin: string, amount: number): Observable<any> {
    return this.http.get(`${this.bff}/msi`, { params: { bin, amount: String(amount) }, withCredentials: true });
  }

  precargarUbicacion(): Observable<UbicacionPago> {
    this.ubicacionPrecargada = this.obtenerUbicacion().pipe(shareReplay(1));
    return this.ubicacionPrecargada;
  }

  procesarTransaccion(payload: Record<string, unknown>): Observable<any> {
    return (this.ubicacionPrecargada ?? of({ latitud: '', longitud: '' })).pipe(
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

        /* console.log('*BODY* :: ',payloadConUbicacion); */

        return this.http.post(
          `${this.bff}/transaccion`,
          payloadConUbicacion,
          { withCredentials: true }
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
