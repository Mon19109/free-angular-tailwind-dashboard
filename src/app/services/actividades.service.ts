import { environment } from '../environments/environments';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Actividad {
  id?: number | string;
  idActivity?: number | string;
  code?: number | string;
  description?: string;
  descripcion?: string;
  activity?: string;
  actividad?: string;
  name?: string;
  nombre?: string;
  label?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class ActividadesService {
  private readonly http = inject(HttpClient);
  private readonly apiV1Url = '/api/v3/antares.kwt-v2.2.10/api/v1/';

  getActividades(): Observable<Actividad[]> {
    return this.http.get<unknown>(
      `${this.apiV1Url}getActividades`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.extractActividades(response))
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Authorization': `Bearer ${environment.bearerTokens.portal}`,
      'versionApp': '3',
    });
  }

  private extractActividades(response: unknown): Actividad[] {
    if (Array.isArray(response)) return response as Actividad[];
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
      body['actividades'],
      body['activities'],
    ];

    const list = possibleLists.find(Array.isArray);
    if (Array.isArray(list)) return list as Actividad[];

    for (const value of Object.values(body)) {
      const nestedList = this.extractActividades(value);
      if (nestedList.length) return nestedList;
    }

    return [];
  }
}
