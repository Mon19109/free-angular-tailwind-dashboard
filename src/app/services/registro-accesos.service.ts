import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface RegistroAccesoPayload {
  sirioId: string;
  idAffiliationLevel: number;
  idProfile: 5 | 7;
  name: string;
  paternalSurname: string;
  maternalSurname: string;
  email: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroAccesosService {
  private readonly http = inject(HttpClient);

  //agregarUsuario(payload: RegistroAccesoPayload, bearerToken: string): Observable<unknown> {
 agregarUsuario(payload: RegistroAccesoPayload): Observable<unknown> {

 const bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

    return this.http.post<{ success?: boolean; message?: string }>(`${environment.api.kashpay}AntaresAuthAPI/api/v1/user/add`, payload, {
      headers: new HttpHeaders({ Authorization: `Bearer ${bearerToken}`, versionApp: '3' })
    }).pipe(map(response => {
      if (response?.success === false) throw new Error(response.message || 'No fue posible crear el acceso.');
      return response;
    }));
  }
}
