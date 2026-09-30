import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface RegistroLiquidacionPayload {
  identifier: string;
  nameAlias: string;
  cardNumberMask: string;
  numberPhone: string;
  typeRegister: 'CL';
  email: string;
  typeTransfer: 1;
  fullName: string;
  nameInstitution: string;
  idInstitution: number;
  razonSocial: string;
  accountNumber: string | null;
  beneficiaryType: 'PF' | 'PM';
  show: true;
  aditionalData: {
    addressBank: { street: string };
    beneficiaryAddress: { street: string };
    aditionalReferences: string[];
    destinationCountry: string;
    intermediaryBank: string;
    bankName: string;
    bankPhone: string;
    bankEmail: string;
    currency: '484';
    businessLine?: string;
    businessActivity?: string;
    typeAccount: 'PF' | 'PM';
  };
}

@Injectable({ providedIn: 'root' })
export class RegistroLiquidacionService {
  private readonly http = inject(HttpClient);

 // registrar(payload: RegistroLiquidacionPayload, bearerToken: string): Observable<{ success?: boolean; message?: string }> {
    registrar(
  payload: RegistroLiquidacionPayload
): Observable<{ success?: boolean; message?: string }> {
  const bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
    return this.http.post<{ success?: boolean; message?: string }>(`${environment.api.KashpayCoreAPI}contact`, payload, {
      headers: new HttpHeaders({ Authorization: `Bearer ${bearerToken}`, versionApp: '3' })
    });
  }
}
