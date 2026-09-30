import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface RegistroLiquidacionPayload {
  idUser: string | number;
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

  registrar(payload: RegistroLiquidacionPayload, bearerToken: string): Observable<{ success?: boolean; message?: string }> {
    return this.http.post<{ success?: boolean; message?: string }>(`${environment.api.kashpay}api/v1/register`, payload, {
      headers: new HttpHeaders({ Authorization: `Bearer ${bearerToken}`, versionApp: '3' })
    });
  }
}
