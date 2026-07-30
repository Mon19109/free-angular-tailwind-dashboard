import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PreregistroCompletoService {
  private readonly http = inject(HttpClient);
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
  private apiUrl = '';

  enviarPreRegistro(payload: unknown): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}/KashpayCoreAPI/api/v1/merchant/pre-register`,
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
      'Authorization': `Bearer ${this.bearerToken}`,
    });
  }
}
