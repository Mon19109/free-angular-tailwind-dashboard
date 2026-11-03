import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SeguimientoNavigationService } from './seguimiento-navigation.service';

export interface DocumentoSeguimiento {
  ref: string;
  name: string | null;
  documentType: string | null;
  status: string | null;
}

@Injectable({ providedIn: 'root' })
export class SeguimientoProspectoService {
  private readonly http = inject(HttpClient);
  private readonly navigation = inject(SeguimientoNavigationService);

  guardarAccesos(nodeRef: string, users: Array<{kind: string; name: string; paternalSurname: string; maternalSurname: string; email: string; phoneNumber: string}>): Observable<{success: boolean; registration?: {status: string}}> {
    return this.navigation.request(options => this.http.post<{success: boolean; registration?: {status: string}}>(
      `/api/seguimiento-prospecto/nodos/${encodeURIComponent(nodeRef)}/accesos`, { users },
      options
    )).pipe(map(response => { if (response?.success !== true) throw new Error('No fue posible confirmar los accesos.'); return response; }));
  }

  renovarAcceso(): Observable<unknown> {
  return this.navigation.request(options => this.http.post(
    '/api/seguimiento-prospecto/renovar',
    {},
    options
  ));
}
    consultarCuenta(): Observable<unknown> {
    return this.navigation.request(options => this.http.get(
      '/api/seguimiento-prospecto/cuenta',
      options
    ));
  }

  consultarArbol(): Observable<unknown> {
    return this.navigation.request(options => this.http.get(
      '/api/seguimiento-prospecto/arbol',
      options
    ));
  }

  consultarLiquidacionNodo(nodeRef: string): Observable<unknown> {
  return this.navigation.request(options => this.http.get(
    `/api/seguimiento-prospecto/nodos/${encodeURIComponent(nodeRef)}/liquidacion`,
    options
  ));
}

guardarDispersionEnRed(nodeRef: string): Observable<unknown> {
  return this.navigation.request(options => this.http.put(
    `/api/seguimiento-prospecto/nodos/${encodeURIComponent(nodeRef)}/dispersion`,
    { dispersionAccount: 'NETWORK' },
    options
  ));
}

  consultarDocumentos(): Observable<{ success: true; documents: DocumentoSeguimiento[] }> {
    return this.navigation.request(options => this.http.get<{ success: boolean; documents: DocumentoSeguimiento[] }>(
      '/api/seguimiento-prospecto/documentos',
      options
    )).pipe(map(response => {
      if (response?.success !== true || !Array.isArray(response.documents)
        || response.documents.some(document => !document || typeof document.ref !== 'string'
          || !document.ref || [document.name, document.documentType, document.status]
            .some(value => value !== null && typeof value !== 'string'))) {
        throw new Error('No fue posible confirmar la consulta de documentos.');
      }
      // El contrato público sólo contiene metadatos; nunca trasladar URL o claves privadas.
      return { success: true as const, documents: response.documents.map(({ ref, name, documentType, status }) => ({ ref, name, documentType, status })) };
    }));
  }

  completar(_url: string): Observable<void> {
    return this.navigation.request(options => this.http.put<{ success?: boolean; message?: string } | null>(
      '/api/seguimiento-prospecto/completar',
      {},
      options
    )).pipe(map(respuesta => {
      if (respuesta?.success !== true) {
        throw new Error('No fue posible confirmar la finalización del seguimiento del prospecto.');
      }
    }));
  }
    guardarLiquidacion(formData: FormData): Observable<{
    success: boolean;
    message?: string;
  }> {
    return this.navigation.request(options => this.http.post<{
      success: boolean;
      message?: string;
    }>(
      '/api/seguimiento-prospecto/liquidacion',
      formData,
      options
    )).pipe(
      map(respuesta => {
        if (respuesta?.success !== true) {
          throw new Error('No fue posible procesar la liquidación.');
        }

        return respuesta;
      })
    );
  }
}
