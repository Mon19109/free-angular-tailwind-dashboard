import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface RegimenFiscal {
  id?: number | string;
  code?: string;
  key?: string;
  value?: string;
  label?: string;
  taxRegime?: string;
  taxRegimeDescription?: string;
  fiscalRegime?: string;
  fiscalRegimeCode?: string;
  fiscalRegimeDescription?: string;
  idFiscalRegime?: number | string;
  regimenFiscal?: string;
  regimen?: string;
  description?: string;
  descripcion?: string;
  shortDescription?: string;
  longDescription?: string;
  name?: string;
  nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegimenFiscalService {
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
  private readonly http = inject(HttpClient);
  private readonly apiV1Url = `${environment.api.kashpay}api/v1/`;

  getAll(): Observable<Array<RegimenFiscal | string>> {
    return this.http.get<unknown>(
      `${this.apiV1Url}fiscalRegimes/getAll`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.extractRegimenes(response))
    );
  }

  getAllOptions(): Observable<string[]> {
    return this.getAll().pipe(
      map(regimenes => regimenes
        .map(regimen => this.toOptionLabel(regimen))
        .filter((regimen): regimen is string => !!regimen)
      )
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.bearerToken}`
    });
  }

  private extractRegimenes(response: unknown): Array<RegimenFiscal | string> {
    if (Array.isArray(response)) return response as Array<RegimenFiscal | string>;
    if (!response || typeof response !== 'object') return [];

    const body = response as Record<string, unknown>;
    const possibleLists = [
      body['data'],
      body['response'],
      body['result'],
      body['items'],
      body['object'],
      body['payload'],
      body['content'],
      body['fiscalRegimes'],
      body['regimenesFiscales'],
      body['regimes'],
    ];

    const list = possibleLists.find(Array.isArray);
    if (Array.isArray(list)) return list as Array<RegimenFiscal | string>;

    for (const value of Object.values(body)) {
      const nestedList = this.extractRegimenes(value);
      if (nestedList.length) return nestedList;
    }

    return [];
  }

  private toOptionLabel(regimen: RegimenFiscal | string): string {
    if (typeof regimen === 'string') return regimen.trim();

    const code = regimen.code
      ?? regimen.key
      ?? regimen.value
      ?? regimen.taxRegime
      ?? regimen.fiscalRegime
      ?? regimen.fiscalRegimeCode
      ?? regimen.regimenFiscal
      ?? regimen.regimen
      ?? regimen.idFiscalRegime
      ?? regimen.id;

    const description = regimen.label
      ?? regimen.taxRegimeDescription
      ?? regimen.fiscalRegimeDescription
      ?? regimen.description
      ?? regimen.descripcion
      ?? regimen.shortDescription
      ?? regimen.longDescription
      ?? regimen.name
      ?? regimen.nombre;

    if (code && description) return `${code} - ${description}`;
    return String(description ?? code ?? '').trim();
  }
}
