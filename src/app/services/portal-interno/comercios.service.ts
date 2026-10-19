import { Injectable, inject } from '@angular/core';
import { PortalInternoHttpService } from './portal-interno-http.service';
import { CambiosComercio, ComercioDetalle, ComercioResumen, FiltrosComercios, NodoComercio, ResultadoOperacion, ResultadoPld } from './portal-interno.models';

@Injectable({ providedIn: 'root' })
export class PortalComerciosService {
  private readonly http = inject(PortalInternoHttpService);
  buscar(filtros: FiltrosComercios) {
    return this.http.request<{ comercios: ComercioResumen[] }>('POST', 'buscar', filtros);
  }
  consultar(ref: string) {
    return this.http.request<ComercioDetalle>('GET', this.http.referencia(ref));
  }
  arbol(ref: string) {
    return this.http.request<{ nodos: NodoComercio[] }>('GET', `${this.http.referencia(ref)}/arbol`);
  }
  actualizar(ref: string, cambios: CambiosComercio) {
    return this.http.request<ResultadoOperacion>('PATCH', `${this.http.referencia(ref)}/datos`, cambios);
  }
  consultarPld(ref: string) {
    return this.http.request<{ resultados: ResultadoPld[] }>('GET', `${this.http.referencia(ref)}/pld`);
  }
  activar(ref: string) {
    return this.http.request<ResultadoOperacion>('POST', `${this.http.referencia(ref)}/activacion`, {});
  }
}
