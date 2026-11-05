import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface CuentaReporte {
  idSirio: string;
  guidCommerce: string;
  name: string;
  levelType?: number;
}
export interface FiltroReporte {
  periodo: string; // Ej. "2026 Octubre"
  tipoCuenta: 'Cuenta Adquirente' | 'Cuenta Emision' | 'Cuenta Emisión' | 'Cuenta Reserva';
  guid: string;
  cuenta: string;
}
export type TipoDescarga='estado-pdf'|'estado-excel'|'transacciones'|'diario'|'split'|'conciliacion';

@Injectable({providedIn:'root'})
export class ReportesService {
  private readonly http=inject(HttpClient);
  private readonly base='/api/reportes';
  obtenerCuentas():Observable<{cuentas:CuentaReporte[]}>{
    return this.http.get<{cuentas:CuentaReporte[]}>(`${this.base}/cuentas`,{withCredentials:true});
  }
  buscar(filtro:FiltroReporte):Observable<{rows:unknown}>{
    return this.http.post<{rows:unknown}>(`${this.base}/buscar`,filtro,{withCredentials:true});
  }
  buscarReporte(filtro:FiltroReporte,reporte:string):Observable<{rows:unknown}>{
    return this.http.post<{rows:unknown}>(`${this.base}/buscar-reporte`,{...filtro,reporte},{withCredentials:true});
  }
  descargar(tipo:TipoDescarga,filtro:Partial<FiltroReporte>&{fecha?:string;clabe?:string}):Observable<Blob>{
    return this.http.post(`${this.base}/descargar`,{tipo,...filtro},{withCredentials:true,responseType:'blob'});
  }
  guardarArchivo(blob:Blob,nombre:string):void {
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=nombre;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
