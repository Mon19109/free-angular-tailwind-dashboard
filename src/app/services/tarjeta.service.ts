import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Cuenta {
  type?: number;
  active?: boolean;
  id: number;
  nombre: string;
  numero: string;
  saldo?: number;
}

export interface FormularioData {
  entidad: string;
  tarjeta: string;
}

@Injectable({ providedIn: 'root' })
export class TarjetaService {
  private readonly baseUrl = '/api/tarjeta';

  constructor(private http: HttpClient) {}

  obtenerCuentas(): Observable<Cuenta[]> {
    return this.http.get<Cuenta[]>(`${this.baseUrl}/cuentas`, { withCredentials: true });
  }

  enviarFormulario(formData: FormularioData): Observable<any> {
    return this.buscarTarjetas(formData);
  }

  enviarFormularioComoParams(formData: FormularioData): Observable<any> {
    return this.buscarTarjetas(formData);
  }

  private buscarTarjetas(formData: FormularioData): Observable<any> {
    const params = new HttpParams()
      .set('entidad', formData.entidad ?? '')
      .set('tarjeta', formData.tarjeta ?? '');
    return this.http.get(`${this.baseUrl}/buscar`, { params, withCredentials: true });
  }
}
