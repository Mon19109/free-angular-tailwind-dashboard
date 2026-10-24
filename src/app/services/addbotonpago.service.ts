import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface SearchLinkResponse<T = any> {
  rows: T;
}

@Injectable({ providedIn: 'root' })
export class AddBotonPagoService {
  private readonly http = inject(HttpClient);
  private readonly checkoutUrl = '/api/addbotonpago/checkout/';

  searchLink(referencia: string): Observable<SearchLinkResponse> {
    return this.http.get(
      `${this.checkoutUrl}${encodeURIComponent(referencia)}`
    ).pipe(
      map(response => ({ rows: response }))
    );
  }
}
