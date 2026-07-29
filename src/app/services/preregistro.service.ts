import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';


export interface FiltrosTransaccion {
  subafiliado?: string;
  entidad?: string;
  sucursal?: string;
  caja?: string;
  operacion?: string;
  monto?: string;
  edoTransaccion?: string;
  referencia?: string;
  autorizacion?: string;
  numTarjeta?: string;
  bin?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface FormularioData {
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  tel: string;
  email: string;
  ref1: string;
  ref2: string;
  monto: number;
  refCom: string;
  concepto: string;
  fechaVen: string;
  propina: boolean;
  msi: boolean;
}

export interface PreRegistro {
  idOperation: number;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  tel: string;
  email: string;
  ref1: string;
  ref2: string;
  monto: number;
  refCom: string;
  concepto: string;
  fechaVen: string;
  propina: boolean;
  msi: boolean;
    
}

export interface GiroComercial {
  familia?: string;
  descripcion?: string;
  description?: string;
  mcc?: string;
  giro?: string;
  idGiro?: string;
  id?: string | number;
  [key: string]: unknown;
}


@Injectable({
  providedIn: 'root'
})
export class PreRegistroService {
  private http = inject(HttpClient);
  private baseUrl = environment.api.linkpago; // Tu base URLAdquirenciaAdquirencia
  private apiV1Url = `${environment.api.kashpay}api/v1/`;
  private girosBearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';

  //user: UserSessionData | null = null;

  getGirosByFamily(family: string): Observable<unknown> {
    const params = new HttpParams().set('family', family);
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.girosBearerToken}`
    });

    return this.http.get<unknown>(`${this.apiV1Url}getGirosByFamily`, { headers, params });
  }

  

}
