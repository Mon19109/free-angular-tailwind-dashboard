import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environments';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';
import { DocumentoRegistroCompleto, TipoNegocioBff } from './preregistro-completo.service';

export interface NodoAvancePreregistro {
  id: string;
  nombre: string;
  nivel: 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja';
  ruta: string;
  hijos?: NodoAvancePreregistro[];
}
export interface AvancePreregistro {
  success: boolean;
  comercioCreado: boolean;
  estado: string;
  tipoNegocio: TipoNegocioBff;
  arbol: NodoAvancePreregistro[];
  guidsPorNodo: Record<string, string>;
}
export interface ResultadoCargaPreregistro {
  success: boolean;
  documentacion?: { estado: string; idStatus?: number; motivo?: string };
}
@Injectable({ providedIn: 'root' })
export class PreregistroAvanceService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.preregistroBff.registroCompletoUrl}/avance`;
  private options(comprobante: string) {
    return { context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
      headers: new HttpHeaders({ 'X-Preregistro-Comprobante': comprobante }) };
  }
  crear(comprobante: string, tipoNegocio: TipoNegocioBff, arbol: NodoAvancePreregistro[], payloadCompleto: Record<string, unknown>) {
    return this.http.post<AvancePreregistro>(this.url, { comprobante, tipoNegocio, arbol, payloadCompleto }, this.options(comprobante));
  }
  consultar(comprobante: string) {
    return this.http.get<AvancePreregistro>(this.url, this.options(comprobante));
  }
  actualizar(comprobante: string, nodoId: string, datos: Record<string, unknown>) {
    return this.http.put<{ success: boolean }>(`${this.url}/nodos/${encodeURIComponent(nodoId)}`, { datos }, this.options(comprobante));
  }
  subirDocumentos(comprobante: string, documentos: DocumentoRegistroCompleto[]) {
    const body = new FormData();
    body.append('documentos', JSON.stringify(documentos.map(doc => ({ nodoId: doc.nodoId, numeroDocumento: Number(doc.numeroDocumento) }))));
    documentos.forEach(doc => body.append('files', doc.file, doc.file.name));
    return this.http.post<ResultadoCargaPreregistro>(`${this.url}/documentos`, body, this.options(comprobante));
  }
}
