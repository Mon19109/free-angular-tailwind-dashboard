import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class DetalleLinkPagoService {
  private readonly sessionAuth = inject(AuthService);
  private readonly apiUrl = environment.api.linkpago;

  constructor(private http: HttpClient) { }

  obtenerDetalle(referencia: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.sessionAuth.getToken() || ''}`,
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
