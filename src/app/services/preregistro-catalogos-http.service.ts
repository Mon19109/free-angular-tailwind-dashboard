import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, defer, finalize, map, shareReplay } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

// Solo transporte público. Los servicios existentes conservan sus normalizadores.
@Injectable({ providedIn: 'root' })
export class PreregistroCatalogosHttpService {
  private readonly http = inject(HttpClient);
  private readonly pendientes = new Map<string, Observable<any>>();

  get<T = unknown>(url: string, params = new HttpParams()): Observable<T> {
    const key = `${url}?${params.toString()}`;
    const pendiente = this.pendientes.get(key);
    if (pendiente) return pendiente;
    const request = defer(() => this.http.get<T>(url, {
      params, context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
    })).pipe(
      map(response => {
        if (!response || typeof response !== 'object' || ('success' in response && response.success === false)) {
          throw new Error('No fue posible consultar el catálogo de prerregistro.');
        }
        return response;
      }),
      finalize(() => this.pendientes.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.pendientes.set(key, request);
    return request;
  }
}
