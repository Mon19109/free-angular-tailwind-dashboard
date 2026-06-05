import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class SaldosService {

  private apiUrl = environment.api.saldos;

  constructor(private http: HttpClient) {}

  getSaldo(idSaldo: string): Observable<any> {

    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');

    return this.http.get(
      `${this.apiUrl}getBalance/${idSaldo}`,
      { headers }
    );
  }
  getDetalleSaldo(
  fatherId: string,
  page: number = 0,
  size: number = 10
): Observable<any> {

  const headers = new HttpHeaders()
    .set('Authorization', 'Basic YWRtaW46c2VjcmV0');

  return this.http.get(
    `${this.apiUrl}all?fatherID=${fatherId}&type=1&status=25&page=${page}&size=${size}`,
    { headers }
  );
}
}