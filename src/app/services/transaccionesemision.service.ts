import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntidadEmision, EntidadesEmisionService } from './entidades-emision.service';

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
 private readonly entidadesService = inject(EntidadesEmisionService);
 constructor(private http:HttpClient){}
 obtenerCuentas():Observable<EntidadEmision[]>{return this.entidadesService.obtenerEntidades([4, 5, 6]);}
 obtenerTiposOperacion():Observable<TipoOperacion[]>{return this.http.get<TipoOperacion[]>(`${this.base}/tipos-operacion`);}
 obtenerStatus():Observable<Status[]>{return this.http.get<Status[]>(`${this.base}/status`);}
 enviarFormulario(formData:FormularioData):Observable<any>{
   return this.http.post(`${this.base}/buscar`,formData,{
     headers: { 'X-Portal-Request': '1' }
   });
 }
 enviarFormularioComoParams(formData:FormularioData):Observable<any>{
   return this.http.post(`${this.base}/consultas`,formData,{
     headers: { 'X-Portal-Request': '1' }
   });
 }
 
}
