import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface VoucherResponse {
  success?: boolean;
  voucher?: string;
  message?: string;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly http = inject(HttpClient);
  private readonly orderUrl = `${environment.api.linkpago}order/`;
  private readonly voucherUrl = `${environment.api.voucher}voucher`;
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';


  obtenerOrden(reference: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.bearerToken}`,
      'Entity-i': 'com.onsigna',
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.get(
      `${this.orderUrl}${encodeURIComponent(reference)}`,
      { headers }
    );
  }

  obtenerVoucher(reference: string): Observable<VoucherResponse> {
    const headers = new HttpHeaders({
      AuthorizationToken: 'Bearer 23423',
      'Entity-i': 'com.sub.tecs',
      terminalId: 'dddd',
      Authorization: `Bearer ${environment.api.BEARER_TOKEN}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<VoucherResponse>(this.voucherUrl, {
      terminalId: '',
      rrcext: '',
      authorizationNumber: '',
      authorizationId: '',
      operationId: reference,
      user: 'test@correo.com'
    }, { headers });
  }
}
