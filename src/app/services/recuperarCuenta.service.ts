import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface RecuperarCuentaRequest {
  guid: string;
  nueva: string;
}

@Injectable({ providedIn: 'root' })
export class RecuperarCuentaService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.api.KashpayCoreAPI}auth/password-reset-confirm`;
  private readonly keyPassword = environment.bearerTokens.portal;

  recuperarCuenta(data: RecuperarCuentaRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.keyPassword}`,
      'versionApp': '3',
      'Content-Type': 'application/json'
    });

    return this.http.put(this.endpoint, {
      token: data.guid,
      newPassword: data.nueva
    }, { headers });
  }
}
