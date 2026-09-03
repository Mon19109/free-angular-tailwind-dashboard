import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface RecuperarCuentaRequest {
  guid: string;
  nueva: string;
}

@Injectable({ providedIn: 'root' })
export class RecuperarCuentaService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.api.KashpayCoreAPI}auth/password-reset-confirm`;
  private readonly keyPassword = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

  recuperarCuenta(data: RecuperarCuentaRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.keyPassword}`,
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.put(this.endpoint, {
      token: data.guid,
      newPassword: data.nueva
    }, { headers });
  }
}
