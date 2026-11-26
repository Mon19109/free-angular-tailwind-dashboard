import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

export interface Afiliacion {
  id?: number;
  number: string;
  businessLine: string;
  processor: 'AMEX' | 'PROSA';
}
export interface AfiliacionesResponse {
  success: boolean;
  name: string;
  affiliations: Afiliacion[];
  revision: string;
  writeBlocked: boolean;
  message: string;
}
@Injectable({ providedIn: 'root' })
export class AfiliacionesService {
  private readonly http = inject(HttpClient);
  private url(ref: string): string { return `/api/comercios/${encodeURIComponent(ref)}/afiliaciones`; }
  private checked(response: AfiliacionesResponse): AfiliacionesResponse {
    if (response?.success !== true || !Array.isArray(response.affiliations) || response.affiliations.length > 2 ||
        typeof response.name !== 'string' || typeof response.revision !== 'string' ||
        typeof response.writeBlocked !== 'boolean' || typeof response.message !== 'string' ||
        new Set(response.affiliations.map(row => row.processor)).size !== response.affiliations.length ||
        response.affiliations.some(row => !['AMEX', 'PROSA'].includes(row.processor) ||
          !Number.isSafeInteger(row.id) || (row.id ?? 0) <= 0 || typeof row.number !== 'string' || typeof row.businessLine !== 'string')) {
      throw new Error('No fue posible verificar las afiliaciones. Consulta nuevamente antes de guardar.');
    }
    return response;
  }
  consultar(ref: string) {
    return this.http.get<AfiliacionesResponse>(this.url(ref), { withCredentials: true })
      .pipe(map(response => this.checked(response)));
  }
  guardar(ref: string, method: 'POST' | 'PUT', affiliations: Afiliacion[], revision: string) {
    // The BFF keeps the operation open through its verification GET.
    return this.http.request<AfiliacionesResponse>(method, this.url(ref), {
      body: { affiliations, revision }, withCredentials: true, headers: { 'X-Portal-Request': '1' }
    }).pipe(map(response => {
      const result = this.checked(response);
      if (result.writeBlocked || result.affiliations.length !== 2 || affiliations.some(expected => {
        const actual = result.affiliations.find(row => row.processor === expected.processor);
        return !actual || actual.number !== expected.number || actual.businessLine !== expected.businessLine ||
          (method === 'PUT' && actual.id !== expected.id);
      })) throw new Error('No fue posible verificar los datos guardados. Consulta nuevamente.');
      return result;
    }));
  }
}
