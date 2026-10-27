import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

export type FiltroPagoDistancia =
  | 'Apellido Paterno' | 'Apellido Materno' | 'Nombre' | 'Concepto'
  | 'Correo Electrónico' | 'Monto' | 'Referencia del comercio'
  | 'Teléfono' | 'Fecha de expiración' | '';

export interface BusquedaPagoDistanciaData {
  filtro: FiltroPagoDistancia;
  busqueda: string;
  fechaCreacion: string;
}

@Injectable({ providedIn: 'root' })
export class PagoDistanciaService {
  private readonly sessionAuth = inject(AuthService);
  private readonly bffUrl = '/api/pago-distancia';
  constructor(private http: HttpClient) {}

  buscarOrdenes(formData: BusquedaPagoDistanciaData): Observable<any> {
    // Preserve original public method; BFF builds the upstream search payload.
    return this.http.post<any>(`${this.bffUrl}/buscar-ordenes`, {
      ...formData,
      sirioID: this.sessionAuth.getSessionValue('entitySonID') || ''
    }, {
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
    });
  }
}
