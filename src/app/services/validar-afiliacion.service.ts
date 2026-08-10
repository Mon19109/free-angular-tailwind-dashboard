import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ValidarAfiliacionRequest {
  affiliationNumber: string;
}

export interface ValidarAfiliacionResponse {
  success?: boolean;
  error?: {
    name?: string | null;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class ValidarAfiliacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/commerce/validateAffiliation`;
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

  validar(affiliationNumber: string): Observable<ValidarAfiliacionResponse> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.bearerToken}`,
      'Content-Type': 'application/json',
    });

    return this.http.post<ValidarAfiliacionResponse>(
      this.url,
      { affiliationNumber },
      { headers }
    );
  }
}
