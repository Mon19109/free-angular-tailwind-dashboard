import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ActivarProspectoPayload {
  commerceGuid: string;
}

@Injectable({ providedIn: 'root' })
export class ActivarProspectoService {
  private readonly sessionAuth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/v1/commerce/activateProspect`;

  activarProspecto(commerceGuid: string): Observable<unknown> {
    return this.http.post(
      this.url,
      { commerceGuid },
      { headers: this.headers() }
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.obtenerToken()}`
    });
  }

  private obtenerToken(): string {
    return this.sessionAuth.getToken() || '';
  }
}
