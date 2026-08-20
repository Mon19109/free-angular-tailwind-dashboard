import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class DetalleLinkPagoService {
  private readonly apiUrl = environment.api.linkpago;

  constructor(private http: HttpClient) { }

  obtenerDetalle(referencia: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'versionApp': '3',
      'Entity-i': 'com.onsigna',
      'Content-Type': 'application/json'
    });

    return this.http.get(
      `${this.apiUrl}order/${encodeURIComponent(referencia)}`,
      { headers }
    );
  }
}
