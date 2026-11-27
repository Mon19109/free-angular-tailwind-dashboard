import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface EntidadEmision {
  type: string | number;
  active: boolean;
  account?: string;
  bundle?: string;
  sirioId?: string;
  sirioID?: string;
  idSirio?: string;
  name?: string;
  bussinesName?: string;
  businessName?: string;
}

@Injectable({ providedIn: 'root' })
export class EntidadesEmisionService {
  private readonly http = inject(HttpClient);

  obtenerEntidades(niveles: readonly number[] = [4]): Observable<EntidadEmision[]> {
    // Esta ruta llama a getEntityLevels y obtiene fatherId de la sesión del BFF.
    return this.http.get<unknown>('/api/transacciones-emision/cuentas', {
      withCredentials: true
    }).pipe(map(response => {
      const data = response as { rows?: unknown; content?: unknown } | null;
      const lista = Array.isArray(response) ? response : data?.rows ?? data?.content;
      if (!Array.isArray(lista)) throw new Error('Formato de entidades no válido');
      return lista.filter((item): item is EntidadEmision =>
        !!item && niveles.includes(Number(item.type)) && item.active === true);
    }));
  }
}
