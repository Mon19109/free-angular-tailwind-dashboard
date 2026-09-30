import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '../environments/environments';

export interface DocumentoPreregistroUpload {
  guid: string;
  fileName: string;
  file: File;
}

@Injectable({
  providedIn: 'root'
})
export class PreregistroDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.api.documents;

  subirDocumentos(documentos: DocumentoPreregistroUpload[], bearerToken?: string, opciones: { crearDirectorio?: boolean } = {}): Observable<unknown[]> {
    if (!documentos.length) {
      console.info('[Preregistro documentos] No hay archivos para subir.');
      return of([]);
    }

    const porGuid = documentos.reduce<Record<string, DocumentoPreregistroUpload[]>>((grupo, documento) => {
      grupo[documento.guid] = [...(grupo[documento.guid] ?? []), documento];
      return grupo;
    }, {});

    console.info('[Preregistro documentos] Archivos agrupados por comercio:', Object.entries(porGuid).map(([guid, docs]) => ({
      guid,
      archivos: docs.map(documento => ({
        nombre: documento.fileName,
        tipo: documento.file.type,
        tamanoBytes: documento.file.size,
      })),
    })));

    return forkJoin(
      Object.entries(porGuid).map(([guid, docs]) =>
        opciones.crearDirectorio === false
          ? this.subirDocumentosDirectorio(guid, docs, bearerToken)
          : this.crearDirectorio(guid, bearerToken).pipe(
          switchMap(respuesta => (respuesta as { success?: boolean } | null)?.success === false
            ? throwError(() => new Error('No fue posible crear el directorio de documentos.'))
            : this.subirDocumentosDirectorio(guid, docs, bearerToken))
        )
      )
    );
  }

  private crearDirectorio(guid: string, bearerToken?: string): Observable<unknown> {
    const formData = new FormData();
    formData.append('folderName', guid);
    console.info('[Preregistro documentos] Creando carpeta:', guid);
    return this.http.post(`${this.apiUrl}createDirectory`, formData, { headers: this.headers(bearerToken) });
  }

  private subirDocumentosDirectorio(guid: string, documentos: DocumentoPreregistroUpload[], bearerToken?: string): Observable<unknown> {
    const formData = new FormData();
    formData.append('folderName', guid);
    documentos.forEach(documento => {
      formData.append('files', documento.file, documento.fileName);
    });

    console.info('[Preregistro documentos] Subiendo archivos:', {
      guid,
      endpoint: `${this.apiUrl}uploadFiles`,
      archivos: documentos.map(documento => documento.fileName),
    });

    return this.http.post(`${this.apiUrl}uploadFiles`, formData, { headers: this.headers(bearerToken) });
  }

  private headers(bearerToken?: string): HttpHeaders {
    return bearerToken ? new HttpHeaders({ Authorization: `Bearer ${bearerToken}`, versionApp: '3' }) : new HttpHeaders();
  }
}
