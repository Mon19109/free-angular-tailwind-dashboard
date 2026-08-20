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

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'versionApp': '3',
      'Entity-i': 'com.onsigna',
      'Content-Type': 'application/json'
    });
  }
}
