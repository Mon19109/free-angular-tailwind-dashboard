import { Injectable } from '@angular/core';
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
  private readonly bffUrl = '/api/pago-distancia';
  constructor(private http: HttpClient) {}

  buscarOrdenes(formData: BusquedaPagoDistanciaData): Observable<any> {
    // Preserve original public method; BFF builds the upstream search payload.
    return this.http.post<any>(`${this.bffUrl}/buscar-ordenes`, {
      ...formData,
      sirioID: localStorage.getItem('entitySonID') || ''
    }, {
      context: new HttpContext().set(SKIP_AUTH_TOKEN, true)
    });
  }
}
