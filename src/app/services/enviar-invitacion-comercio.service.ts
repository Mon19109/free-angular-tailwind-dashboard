import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface EnviarInvitacionComercioRequest {
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class EnviarInvitacionComercioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/commerce/sendingPre_registrationLink`;

  enviarInvitacion(payload: EnviarInvitacionComercioRequest): Observable<any> {
    return this.http.post<any>(this.url, payload);
  }
}
