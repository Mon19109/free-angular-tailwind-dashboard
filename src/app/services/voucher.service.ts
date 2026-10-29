import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface VoucherResponse {
  success?: boolean;
  voucher?: string;
  message?: string;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly http = inject(HttpClient);
  private readonly bff = '/api/pagar-voucher';

  obtenerOrden(reference: string): Observable<any> {
    return this.http.get(`${this.bff}/orden/${encodeURIComponent(reference)}`, { withCredentials: true });
  }

  obtenerVoucher(reference: string): Observable<VoucherResponse> {
    return this.http.post<VoucherResponse>(`${this.bff}/voucher`, { reference }, { withCredentials: true });
  }
}
