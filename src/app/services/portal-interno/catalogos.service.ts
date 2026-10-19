import { Injectable, inject } from '@angular/core';
import { PortalInternoHttpService } from './portal-interno-http.service';
import { OpcionCatalogo } from './portal-interno.models';

@Injectable({ providedIn: 'root' })
export class PortalCatalogosService {
  private readonly http = inject(PortalInternoHttpService);
  actividades() {
    return this.http.request<{ opciones: OpcionCatalogo[] }>('GET', 'catalogos/actividades');
  }
  giros(familia: string) {
    return this.http.request<{ opciones: OpcionCatalogo[] }>('POST', 'catalogos/giros/buscar', { familia });
  }
  localidades(cp: string) {
    if (!/^\d{5}$/.test(cp)) throw new Error('Código postal no válido.');
    return this.http.request<{ opciones: OpcionCatalogo[] }>('GET', `catalogos/localidades/${cp}`);
  }
  instituciones(cuenta: string) {
    return this.http.request<{ opciones: OpcionCatalogo[] }>('POST', 'catalogos/instituciones/buscar', { cuenta });
  }
}
