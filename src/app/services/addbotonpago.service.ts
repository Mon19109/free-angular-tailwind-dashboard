import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface SearchLinkResponse<T = any> {
  rows: T;
}

@Injectable({ providedIn: 'root' })
export class AddBotonPagoService {
  private readonly http = inject(HttpClient);
  private readonly checkoutUrl = `${environment.api.voucher}checkout/`;

  searchLink(referencia: string): Observable<SearchLinkResponse> {
    const headers = new HttpHeaders({
      AuthorizationToken: 'Bearer 1234345'
    });

    return this.http.get(
      `${this.checkoutUrl}${encodeURIComponent(referencia)}`,
      { headers }
    ).pipe(
      map(response => ({ rows: response }))
    );
  }
}
