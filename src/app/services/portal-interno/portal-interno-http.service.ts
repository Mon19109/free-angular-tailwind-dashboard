import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_AUTH_TOKEN } from '../auth-token.interceptor';

/** No usar hasta integrar el router privado con autenticación, autorización y CSRF. */
@Injectable({ providedIn: 'root' })
export class PortalInternoHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = '/portal-interno/comercios/';

  referencia(ref: string): string {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(ref)) throw new Error('Referencia no válida.');
    return ref;
  }

  request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, body?: unknown): Observable<T> {
    return this.http.request<T>(method, this.url(path), {
      body, context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
    });
  }

  contenido(path: string): Observable<Blob> {
    return this.http.get(this.url(path), {
      responseType: 'blob', context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
    });
  }

  private url(path: string): string {
    // Solo rutas propias: no aceptar URLs, query strings ni segmentos relativos.
    if (!/^[A-Za-z0-9_/-]+$/.test(path) || path.startsWith('/') || path.includes('//')) {
      throw new Error('Ruta del portal no válida.');
    }
    return this.base + path;
  }
}
