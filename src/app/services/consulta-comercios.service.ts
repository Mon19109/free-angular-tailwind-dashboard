import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface ConsultaComerciosFiltros {
  nameCommerce?: string;
  email?: string;
  telefono?: string;
  rfc?: string;
  status?: string;
}

export interface ConsultaComercioApi {
  ref?: string;
  displayId?: string;
  nivel?: string;
  jerarquia?: string;
  contextID?: number;
  entityID?: number;
  terminalID?: number;
  terminalUserID?: number;
  userID?: number;
  commerceID?: string;
  entitySonID?: string;
  fatherId?: string | null;
  issueId?: string | null;
  acquiringId?: string | null;
  nameCommerce?: string;
  businessName?: string;
  rfc?: string;
  email?: string;
  fiscalRegime?: string;
  phoneNumber?: string;
  dateTimeCreated?: string;
  idBusinessModel?: number;
  idAffilationLevel?: string;
  guid?: string;
  validate?: string;
  status?: string;
  commerceType?: string;
  typeOfBusiness?: number;
  pldID?: string;
  pldId?: string;
  PLDID?: string;
  nodeID?: number | string;
  [key: string]: unknown;
}

export interface ConsultaPasswordCajaResponse {
  success?: boolean;
  tuPassword?: string;
  password?: string;
  pwd?: string;
  data?: {
    tuPassword?: string;
    password?: string;
    pwd?: string;
    [key: string]: unknown;
  } | string;
  message?: string;
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

export interface ConsultaComerciosResponse {
  success?: boolean;
  commerces?: ConsultaComercioApi[];
  error?: {
    name?: string;
    message?: string;
    code?: string | number;
  };
  [key: string]: unknown;
}

// DTOs públicos definidos por comercios-read.service/adapters del BFF.
export interface ComercioInformacionResponse { success: boolean; information: Record<string, unknown>; }
export interface ComercioPldResponse { success: boolean; pld: Array<{ rfc: string | null; nombre: string | null;
  fechaRegistro: string | null; coincidenciaListas: string | null; categoria: string | null; fuente: string | null }>; }
export interface ComercioDocumentosResponse { success: boolean; documents: Array<{
  ref: string; name: string | null; documentType: string | null; status: string | null }>;
}

export interface ComercioArbolResponse {
  success: boolean;
  tree: Array<{ ref: string; name: string | null; levelType: number; depth: number; status: number | null }>;
}

export interface ComercioContexto {
  success: boolean;
  commerce: { ref: string; nameCommerce: string | null; businessName: string | null;
    rfc: string | null; email: string | null; phoneNumber: string | null; status: string | null; nivel: string };
  navigation: { path: string; actionLabel: string };
  capabilities: Record<string, boolean>;
}

@Injectable({
  providedIn: 'root'
})
export class ConsultaComerciosService {
  private readonly http = inject(HttpClient);

  buscarComercios(filtros: ConsultaComerciosFiltros): Observable<ConsultaComerciosResponse> {
    // Lista explícita: nunca reenviar identificadores ni credenciales del consumidor.
    const body = {
      nameCommerce: filtros.nameCommerce ?? '', email: filtros.email ?? '',
      telefono: filtros.telefono ?? '', rfc: filtros.rfc ?? '', status: filtros.status ?? ''
    };
    return this.http.post<ConsultaComerciosResponse>('/api/comercios/buscar', body, {
      withCredentials: true, headers: new HttpHeaders({ 'X-Portal-Request': '1' })
    });
  }

  consultarInformacionNodo(ref: string, nodeRef: string): Observable<ComercioInformacionResponse> {
    return this.http.get<ComercioInformacionResponse>(`/api/comercios/${encodeURIComponent(ref)}/nodos/${encodeURIComponent(nodeRef)}/informacion-general`, { withCredentials: true });
  }

  consultarPldNodo(ref: string, nodeRef: string): Observable<ComercioPldResponse> {
    return this.http.get<ComercioPldResponse>(`/api/comercios/${encodeURIComponent(ref)}/nodos/${encodeURIComponent(nodeRef)}/pld`, { withCredentials: true });
  }

  consultarDocumentosNodo(ref: string, nodeRef: string): Observable<ComercioDocumentosResponse> {
    return this.http.get<ComercioDocumentosResponse>(`/api/comercios/${encodeURIComponent(ref)}/nodos/${encodeURIComponent(nodeRef)}/documentos`, { withCredentials: true });
  }

  archivoNodoUrl(ref: string, nodeRef: string, documentRef: string): string {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![ref, nodeRef, documentRef].every(value => uuid.test(value))) return '';
    return `/api/comercios/${encodeURIComponent(ref)}/nodos/${encodeURIComponent(nodeRef)}/documentos/${encodeURIComponent(documentRef)}/archivo`;
  }

  consultarArbol(ref: string): Observable<ComercioArbolResponse> {
    return this.http.get<ComercioArbolResponse>(`/api/comercios/${encodeURIComponent(ref)}/arbol`, { withCredentials: true });
  }

  consultarContexto(ref: string): Observable<ComercioContexto> {
    return this.http.get<ComercioContexto>(`/api/comercios/${encodeURIComponent(ref)}/contexto`, { withCredentials: true });
  }

  consultarPasswordCaja(guid: string): Observable<ConsultaPasswordCajaResponse> {
    return this.http.post<ConsultaPasswordCajaResponse>(
      `${environment.api.kashpay}api/v1/user-r7k/v2/shwpwd-f3a917`,
      { guid },
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
