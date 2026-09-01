import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface DocumentoProspectoApi {
  id?: string | number;
  documentID?: string | number;
  documentId?: string | number;
  documentName?: string;
  name?: string;
  fileName?: string;
  originalName?: string;
  s3Key?: string;
  documentType?: string;
  status?: string;
  documentStatus?: string;
  url?: string;
  fileUrl?: string;
  path?: string;
  [key: string]: unknown;
}

export interface DocumentosProspectoResponse {
  success?: boolean;
  commerceId?: string;
  generalStatus?: string;
  internalObservations?: string | null;
  legalDocuments?: DocumentoProspectoApi[];
  documents?: DocumentoProspectoApi[];
  data?: DocumentoProspectoApi[] | { documents?: DocumentoProspectoApi[]; [key: string]: unknown };
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

export type EstatusDocumentoProspecto = 'APPROVED' | 'REJECTED' | 'IN_REVIEW';

export interface ActualizarDocumentosProspectoPayload {
  commerceId: string;
  generalStatus: EstatusDocumentoProspecto;
  internalObservations: string | null;
  reviewedBy: string;
  legalDocuments: Array<{
    id: string;
    status: EstatusDocumentoProspecto;
  }>;
}

export interface EnviarObservacionesPayload {
  email: string;
  observations: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentosProspectoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.kashpay}api/merchantReviewPanel/documents/`;
  private readonly revisionUrl = `${environment.api.kashpay}api/merchantReviewPanel/merchant-documents`;
  private readonly observacionesUrl = `${environment.api.kashpay}api/commerce/sendObservations`;
  private readonly mostrarArchivoUrl = `${environment.api.documents}showFile`;

  consultarDocumentos(commerceID: string): Observable<DocumentosProspectoResponse> {
    return this.http.get<DocumentosProspectoResponse>(
      `${this.baseUrl}${encodeURIComponent(commerceID)}`,
      { headers: this.headers() }
    );
  }

  actualizarRevision(payload: ActualizarDocumentosProspectoPayload): Observable<DocumentosProspectoResponse> {
    return this.http.put<DocumentosProspectoResponse>(
      this.revisionUrl,
      payload,
      { headers: this.headers() }
    );
  }

  enviarObservaciones(payload: EnviarObservacionesPayload): Observable<unknown> {
    return this.http.post(
      this.observacionesUrl,
      payload,
      { headers: this.headers() }
    );
  }

  urlMostrarArchivo(s3Key: string): string {
    return `${this.mostrarArchivoUrl}?fileKey=${encodeURIComponent(s3Key)}`;
  }

  consultarUrlArchivo(s3Key: string): Observable<string> {
    return this.http.get(this.urlMostrarArchivo(s3Key), { responseType: 'text' }).pipe(
      map(response => this.extraerUrlArchivo(response))
    );
  }

  private extraerUrlArchivo(response: string): string {
    try {
      const data = JSON.parse(response) as {
        s3ObjectInfo?: { url?: unknown };
        url?: unknown;
      };
      const url = data.s3ObjectInfo?.url || data.url;
      if (typeof url === 'string' && url.trim()) return this.limpiarUrlArchivo(url);
    } catch {
      // Si no es JSON, intenta parsear XML abajo.
    }

    const xml = new DOMParser().parseFromString(response, 'application/xml');
    const url = xml.querySelector('s3ObjectInfo > url')?.textContent
      || xml.querySelector('url')?.textContent
      || '';

    return this.limpiarUrlArchivo(url);
  }

  private limpiarUrlArchivo(url: string): string {
    return url.trim().replace(/^<|>$/g, '');
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      versionApp: '3',
      Authorization: `Bearer ${this.obtenerToken()}`,
    });
  }

  private obtenerToken(): string {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Usa llaves legacy abajo.
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }
}
