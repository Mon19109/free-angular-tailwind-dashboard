import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class ValidarAfiliacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.kashpay}api/v1/commerce/validateAffiliation`;
 
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
