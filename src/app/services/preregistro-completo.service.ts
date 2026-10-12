import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class PreregistroCompletoService {
  private readonly http = inject(HttpClient);
  private apiUrl = environment.api.KashpayCoreAPI;

  enviarPreRegistro(payload: unknown): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}merchant/pre-register`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  enviarPreRegistroGuardado(): Observable<unknown> {
    const rawPayload = localStorage.getItem('kashpay.preregistro.payload.v1');
    const payload = rawPayload ? JSON.parse(rawPayload) : {};

    return this.enviarPreRegistro(payload);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${environment.bearerTokens.portal}`,
    });
  }
}
