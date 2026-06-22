import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
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


@Injectable({
  providedIn: 'root'
})
export class PreRegistroService {
  private http = inject(HttpClient);
  private baseUrl = environment.api.linkpago; // Tu base URLAdquirenciaAdquirencia

  //user: UserSessionData | null = null;

  

}