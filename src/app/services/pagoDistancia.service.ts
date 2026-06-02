import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
import { AuthService, UserSessionData } from '../services/auth.service';

export interface Cuenta {
  id: number;
  nombre: string;
  numero: string;
  saldo?: number;
}

export interface FormularioData {
  entidad: string;
  tarjeta: string;
}

@Injectable({
  providedIn: 'root'
})
export class PagoDistanciaService {
  private apiUrlCuentas = environment.api.aldebaran;

  
  constructor(private http: HttpClient) { }

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }
  /**
   * Obtiene la lista de cuentas del API
   */

  obtenerCuentas(): Observable<Cuenta[]> {
    return this.http.get<any>(`${this.apiUrlCuentas}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
  }


  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    // Opcional: Puedes transformar los datos si es necesario
    const datosTransformados = {
      ...formData
    };

    return this.http.get(`${this.apiUrlCuentas}getCards?value=${formData.tarjeta}&sirioId=${formData.entidad}`);
  }

  /**
   * Método alternativo para enviar formulario con parámetros query
   * @param formData Datos del formulario
   */
  enviarFormularioComoParams(formData: FormularioData): Observable<any> {
    let params = new HttpParams();
    
    if (formData.tarjeta) params = params.set('cuenta', formData.tarjeta);
    if (formData.entidad) params = params.set('estatus', formData.entidad);

    return this.http.get(`${this.apiUrlCuentas}getCards?value=${formData.tarjeta}&sirioId=${formData.entidad}`);

  }
}