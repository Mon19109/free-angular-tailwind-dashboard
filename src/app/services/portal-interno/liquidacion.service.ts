import { Injectable, inject } from '@angular/core';
import { PortalInternoHttpService } from './portal-interno-http.service';
import { Dispersion, LiquidacionComercio, ResultadoOperacion } from './portal-interno.models';

@Injectable({ providedIn: 'root' })
export class PortalLiquidacionService {
  private readonly http = inject(PortalInternoHttpService);
  actualizarDispersion(ref: string, dispersion: Dispersion) {
    return this.http.request<ResultadoOperacion>('PUT', `${this.http.referencia(ref)}/dispersion`, { dispersion });
  }
  registrar(ref: string, datos: LiquidacionComercio) {
    return this.http.request<ResultadoOperacion>('POST', `${this.http.referencia(ref)}/liquidacion`, datos);
  }
}
