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



  obtenerOrden(reference: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.bearerTokens.portal}`,
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
