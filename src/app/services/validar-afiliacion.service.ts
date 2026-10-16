import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';
import { environment } from '../environments/environments';

export interface ValidarAfiliacionRequest {
  affiliationNumber: string;
}

export interface ValidarAfiliacionResponse {
  success?: boolean;
  nodeId?: number | string;
  accountResponse?: {
    nodeId?: number | string;
    [key: string]: unknown;
  };
  error?: {
    name?: string | null;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

export interface ValidarAfiliacionBffResponse {
  success?: boolean;
  comprobante?: string;
  expiresIn?: number;
  error?: { message?: string };
}

@Injectable({
  providedIn: 'root',
})
export class ValidarAfiliacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/v1/commerce/validateAffiliation`;
 
  validarParaPreregistro(affiliationNumber: string): Observable<ValidarAfiliacionBffResponse> {
    if (!/^[0-9]{1,20}$/.test(affiliationNumber)) {
      return throwError(() => new Error('El número de afiliación debe contener de 1 a 20 dígitos.'));
    }
    return this.http.post<ValidarAfiliacionBffResponse>(
      environment.preregistroBff.validarAfiliacionUrl,
      { affiliationNumber },
      { context: new HttpContext().set(SKIP_AUTH_TOKEN, true) }
    );
  }

  validar(affiliationNumber: string): Observable<ValidarAfiliacionResponse> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${environment.bearerTokens.portal}`,
      'Content-Type': 'application/json',
    });

    return this.http.post<ValidarAfiliacionResponse>(
      this.url,
      { affiliationNumber },
      { headers }
    );
  }
}
