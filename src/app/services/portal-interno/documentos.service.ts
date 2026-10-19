import { Injectable, inject } from '@angular/core';
import { PortalInternoHttpService } from './portal-interno-http.service';
import { GuardarRevision, ResultadoOperacion, RevisionDocumental } from './portal-interno.models';

@Injectable({ providedIn: 'root' })
export class PortalDocumentosService {
  private readonly http = inject(PortalInternoHttpService);
  consultar(ref: string) {
    return this.http.request<RevisionDocumental>('GET', `${this.http.referencia(ref)}/documentos`);
  }
  contenido(ref: string, documentoRef: string) {
    return this.http.contenido(`${this.http.referencia(ref)}/documentos/${this.http.referencia(documentoRef)}/contenido`);
  }
  subir(ref: string, tipo: string, archivo: File) {
    const body = new FormData();
    body.append('tipo', tipo);
    // El nombre original puede contener datos personales y no es necesario para el BFF.
    body.append('archivo', archivo, 'documento');
    return this.http.request<ResultadoOperacion>('POST', `${this.http.referencia(ref)}/documentos`, body);
  }
  guardarRevision(ref: string, revision: GuardarRevision) {
    return this.http.request<ResultadoOperacion>('PUT', `${this.http.referencia(ref)}/revision-documental`, revision);
  }
  enviarObservaciones(ref: string, observaciones: string) {
    return this.http.request<ResultadoOperacion>('POST', `${this.http.referencia(ref)}/observaciones`, { observaciones });
  }
}
