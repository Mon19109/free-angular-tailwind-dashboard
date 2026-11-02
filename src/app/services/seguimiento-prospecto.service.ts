import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

@Injectable({ providedIn: 'root' })
export class SeguimientoProspectoService {
  private readonly http = inject(HttpClient);

  renovarAcceso(): Observable<unknown> {
  return this.http.post(
    '/api/seguimiento-prospecto/renovar',
    {},
    {
      withCredentials: true,
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
      headers: { 'X-Portal-Request': '1' }
    }
  );
}
    consultarCuenta(): Observable<unknown> {
    return this.http.get(
      '/api/seguimiento-prospecto/cuenta',
      {
        withCredentials: true,
        context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
      }
    );
  }

  consultarArbol(): Observable<unknown> {
    return this.http.get(
      '/api/seguimiento-prospecto/arbol',
      {
        withCredentials: true,
        context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
      }
    );
  }

  consultarLiquidacionNodo(nodeRef: string): Observable<unknown> {
  return this.http.get(
    `/api/seguimiento-prospecto/nodos/${encodeURIComponent(nodeRef)}/liquidacion`,
    {
      withCredentials: true,
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
    }
  );
}

guardarDispersionEnRed(nodeRef: string): Observable<unknown> {
  return this.http.put(
    `/api/seguimiento-prospecto/nodos/${encodeURIComponent(nodeRef)}/dispersion`,
    { dispersionAccount: 'NETWORK' },
    {
      withCredentials: true,
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
      headers: { 'X-Portal-Request': '1' }
    }
  );
}

  consultarDocumentos(): Observable<unknown> {
    return this.http.get(
      '/api/seguimiento-prospecto/documentos',
      {
        withCredentials: true,
        context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
      }
    );
  }

  completar(_url: string): Observable<void> {
    return this.http.put<{ success?: boolean; message?: string } | null>(
      '/api/seguimiento-prospecto/completar',
      {},
      { context: new HttpContext().set(SKIP_AUTH_TOKEN, true), withCredentials: true,
        headers: { 'X-Portal-Request': '1' } }
    ).pipe(map(respuesta => {
      if (respuesta?.success !== true) {
        throw new Error('No fue posible confirmar la finalización del seguimiento del prospecto.');
      }
    }));
  }
    guardarLiquidacion(formData: FormData): Observable<{
    success: boolean;
    message?: string;
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
    }>(
      '/api/seguimiento-prospecto/liquidacion',
      formData,
      {
        withCredentials: true,
        context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
        headers: {
          'X-Portal-Request': '1'
        }
      }
    ).pipe(
      map(respuesta => {
        if (respuesta?.success !== true) {
          throw new Error('No fue posible procesar la liquidación.');
        }

        return respuesta;
      })
    );
  }
}
