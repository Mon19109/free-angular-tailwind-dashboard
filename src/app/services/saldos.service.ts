import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class SaldosService {
  private readonly url = '/api/saldos';
  constructor(private http: HttpClient) {}
  getSaldo(idSaldo: string): Observable<any> {
    return this.http.get(`${this.url}/saldo/${encodeURIComponent(idSaldo)}`, { withCredentials: true });
  }
  getDetalleSaldo(fatherId: string, page = 0, size = 10): Observable<any> {
    return this.http.get(`${this.url}/detalle/${encodeURIComponent(fatherId)}`, {
      params: new HttpParams().set('page', page).set('size', size), withCredentials: true
    });
  }
}
