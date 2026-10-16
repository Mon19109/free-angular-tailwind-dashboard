import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, defer } from 'rxjs';
import { environment } from '../environments/environments';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

export type TipoNegocioBff = 'individual' | 'empresa-holding' | 'sucursales-multiples' | 'auditor-unico';

export interface DocumentoRegistroCompleto {
  nodoId: string;
  numeroDocumento: string;
  file: File;
}

export interface SolicitudRegistroCompleto {
  comprobante: string;
  tipoNegocio: TipoNegocioBff;
  payload: Record<string, unknown>;
  arbol: unknown[];
  documentos: DocumentoRegistroCompleto[];
}

export interface RespuestaRegistroCompleto {
  success?: boolean;
  message?: string;
  error?: unknown;
}

@Injectable({ providedIn: 'root' })
export class PreregistroCompletoService {
  private readonly http = inject(HttpClient);

  enviarPreRegistro(solicitud: SolicitudRegistroCompleto): Observable<RespuestaRegistroCompleto> {
    return defer(() => {
      const body = this.construirFormData(solicitud);
      return this.http.post<RespuestaRegistroCompleto>(
        environment.preregistroBff.registroCompletoUrl, body,
        { context: new HttpContext().set(SKIP_AUTH_TOKEN, true) }
      );
    });
  }

  construirFormData(solicitud: SolicitudRegistroCompleto): FormData {
    if (!solicitud.comprobante.trim()) throw new Error('Falta el comprobante de afiliación del BFF.');
    if (!['individual', 'empresa-holding', 'sucursales-multiples', 'auditor-unico'].includes(solicitud.tipoNegocio)) {
      throw new Error('Selecciona un tipo de negocio válido.');
    }
    const body = new FormData();
    body.append('comprobante', solicitud.comprobante);
    body.append('tipoNegocio', solicitud.tipoNegocio);
    const documentos = solicitud.documentos.map(({ nodoId, numeroDocumento, file }) => {
      if (!nodoId || !numeroDocumento || !(file instanceof File)) {
        throw new Error('Vuelve a adjuntar los archivos de los documentos antes de enviar.');
      }
      return { nodoId, numeroDocumento };
    });
    body.append('datos', JSON.stringify({ payload: solicitud.payload, arbol: solicitud.arbol, documentos }));
    solicitud.documentos.forEach(({ file }) => body.append('files', file, file.name));
    return body;
  }
}
