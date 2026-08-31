import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class DocumentosProspectoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.kashpay}api/merchantReviewPanel/documents/`;
  private readonly revisionUrl = `${environment.api.kashpay}api/merchantReviewPanel/merchant-documents`;

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
