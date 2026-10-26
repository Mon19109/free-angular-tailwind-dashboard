import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Cuenta {
  id: number;
  nombre: string;
  numero: string;
  saldo?: number;
}

export interface TipoOperacion {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}
export interface Status {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}
export interface FormularioData {
  cuenta?: string;
  idEntidad?: string;
  monto?: number | string;
  montoDesde?: number | string;
  montoHasta?: number | string;
  numAuto?: string;
  email?: string;
  tel?: string;
  estatus?: string;
  tipoOperacion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({providedIn: 'root'})
export class TransaccionesEmisionService {

 private readonly base='/api/transacciones-emision';
 constructor(private http:HttpClient){}
 obtenerCuentas():Observable<Cuenta[]>{return this.http.get<Cuenta[]>(`${this.base}/cuentas`);}
 obtenerTiposOperacion():Observable<TipoOperacion[]>{return this.http.get<TipoOperacion[]>(`${this.base}/tipos-operacion`);}
 obtenerStatus():Observable<Status[]>{return this.http.get<Status[]>(`${this.base}/status`);}
 enviarFormulario(formData:FormularioData):Observable<any>{return this.http.post(`${this.base}/buscar`,formData);}
 enviarFormularioComoParams(formData:FormularioData):Observable<any>{return this.http.post(`${this.base}/consultas`,formData);}
 
}
