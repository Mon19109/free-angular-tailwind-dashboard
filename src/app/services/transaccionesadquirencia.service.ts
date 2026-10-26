import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FiltrosTransaccion {
  subafiliado?: string;
  entidad?: string;
  sucursal?: string;
  caja?: string;
  operacion?: string;
  monto?: string;
  montoDesde?: string;
  montoHasta?: string;
  email?: string;
  edoTransaccion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface Transaccion {
  idOperation: number;
  terminalId?: string | number;
  idTerminal?: string | number;
  rrcext?: string;
  authorizationId?: string | number;
  context?: string | number;
  idContext?: string | number;
  amount: number;
  authorizationNumber: string;
  card: string;
  authorizationRrcext: string;
  authorizationDate: string;
  concept: string;
  status: string;
  institution: string;
  brand: string;
  nature: string;
  entityName: string;
  terminalName: string;
  terminalUserName: string;
  transactiontype: string;
  entryMode: string;
  payEmail: string;
  payPhone: string;
  referenceOne: string;
  referenceTwo: string;
  referenceThree: string;
  feeAmount: number;
  responseDescription: string;
  qtPay: string;
  planId: string;
  graceNumber: string;
  bin: string;
  sendSirio: string;
  entityOperationId: string;
  transactionBuilder: string;
  liquidation_id: string;
  statusSirio: string;
  latitude: string;
  longitude: string;
  paymentLink: string;
  operationSirio?: any;
}

export interface TicketRequest {
  terminalId: string | number;
  rrcext: string;
  authorizationNumber: string;
  authorizationId: string | number;
  user: string;
  context: string | number;
}

export interface TicketResponse {
  success?: boolean;
  voucher?: string;
  mimeType?: string;
  contentType?: string;
  url?: string;
  ticketUrl?: string;
  voucherUrl?: string;
  data?: {
    url?: string;
  };
}

export interface Subafiliado {
  idContext: number;
  contextDescription: string;
  nodeID?: string;
}

export interface Entidad {
  idEntity: number;
  entityDescription: string;
  nodeID?: string;
}

export interface Sucursal {
  idTerminal: number;
  businessName: string;
  nodeID?: string;
}

export interface Caja {
  idTerminalUser: number;
  tuName: string;
  nodeID?: string;
}
export interface Operacion {
  idTransactionType: number;
  description: string;
}

export interface EstadoTransaccion {
  idResponseCode: number;
  responseDescription: string;
}

@Injectable({providedIn: 'root'})
export class TransaccionesAdquirenciaService {

 private readonly http=inject(HttpClient);
 private readonly base='/api/transacciones-adquirencia';
 getOperaciones():Observable<any>{return this.http.get(`${this.base}/operaciones`);}
 getEstadosTransaccion():Observable<any>{return this.http.get(`${this.base}/estados`);}
 getSubafiliados():Observable<any>{return this.http.get(`${this.base}/subafiliados`);}
 getSubafiliadoById():Observable<any>{return this.http.get(`${this.base}/subafiliado-sesion`);}
 getEntidades(nodeID:string):Observable<any>{return this.http.get(`${this.base}/entidades/${encodeURIComponent(nodeID)}`);}
 getSucursales(nodeID:string):Observable<any>{return this.http.get(`${this.base}/sucursales/${encodeURIComponent(nodeID)}`);}
 getCajas(nodeID:string):Observable<any>{return this.http.get(`${this.base}/cajas/${encodeURIComponent(nodeID)}`);}
 buscarTransacciones(filtros:FiltrosTransaccion):Observable<any>{return this.http.post(`${this.base}/buscar`,filtros);}
 verTicket(data:TicketRequest):Observable<TicketResponse>{return this.http.post<TicketResponse>(`${this.base}/ticket`,data);}
 
}
