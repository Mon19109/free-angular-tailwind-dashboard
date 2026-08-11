import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

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
  referencia?: string;
  autorizacion?: string;
  numTarjeta?: string;
  bin?: string;
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

@Injectable({
  providedIn: 'root'
})
export class TransaccionesAdquirenciaService {
  private http = inject(HttpClient);
  private baseUrl = environment.api.kashpay; // Tu base URLAdquirenciaAdquirencia
  private apiV1Url = `${this.baseUrl}api/v1/`;
  //private wsKashPayServices = environment.api.kashpay;
  private baseUrlTicket = environment.api.voucher; // Tu base URLAdquirenciaAdquirencia

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  // Catalogos
 /* getOperaciones(): Observable<any> {
    const headers = this.getCommonHeaders();
    return this.http.get(`${this.baseUrl}/transacciones/getOperaciones`, { 
          headers: headers,
          withCredentials: true
        });
  }*/


getOperaciones(): Observable<any> {

  const headers = this.getCommonHeaders();

  return this.http.get(
    `${this.apiV1Url}catTransactionType/getAll`,
    {
      headers
    }
  );

}



 getEstadosTransaccion(): Observable<any> {
  const headers = this.getCommonHeaders();

  return this.http.get(
    `${this.apiV1Url}catResponseCode/getAll`,
    { headers }
  );
}

  getSubafiliados(): Observable<any> {
    const headers = this.getCommonHeaders();
    console.log('url = '+this.apiV1Url+'subAffiliation/getAll');
    return this.http.get<any>(
      `${this.apiV1Url}subAffiliation/getAll`, { 
          headers: headers
        }
    );
  }

  getSubafiliadoById(): Observable<any> {
    const headers = this.getCommonHeaders();
    const nodeID = localStorage.getItem('nodeID') || '';

    return this.http.get<any>(
      `${this.baseUrl}api/nodes/${nodeID}/tree?levels=3`, {
          headers: headers,
          withCredentials: true
        }
    );
  }

  /*getSubafiliados(): Observable<any> {
    return this.http.get(`${this.baseUrl}/transacciones/getSubafiliados`);
  }*/

 getEntidades(nodeID: string): Observable<any> {
  const headers = this.getCommonHeaders();

  return this.http.get(
    `${this.baseUrl}api/nodes/${nodeID}/tree?levels=4`,
    { headers }
  );
}

  getSucursales(nodeID: string): Observable<any> {
    const headers = this.getCommonHeaders();

    return this.http.get(
      `${this.baseUrl}api/nodes/${nodeID}/tree?levels=5`,
      { headers }
    );
  }

  getCajas(nodeID: string): Observable<any> {
    const headers = this.getCommonHeaders();

    return this.http.get(
      `${this.baseUrl}api/nodes/${nodeID}/tree?levels=6`,
      { headers }
    );
  }

  // Buscar transacciones
  buscarTransacciones(filtros: FiltrosTransaccion): Observable<any> {
    const headers = this.getCommonHeaders();
    const rootNodeID = this.getRootNodeID(filtros);
    const params = new HttpParams()
      .set('userID', localStorage.getItem('idUser') || '')
      .set('typeOperation', filtros.operacion || '')
      .set('amount', (filtros.monto || filtros.montoDesde || '').replace(/[$,]/g, ''))
      .set('amountFrom', (filtros.montoDesde || '').replace(/[$,]/g, ''))
      .set('amountTo', (filtros.montoHasta || '').replace(/[$,]/g, ''))
      .set('email', filtros.email || '')
      .set('responseCode', filtros.edoTransaccion || '')
      .set('referenceNumber', filtros.referencia || '')
      .set('authorizationNumber', filtros.autorizacion || '')
      .set('bin', filtros.bin || '')
      .set('card', filtros.numTarjeta || '')
      .set('startDate', filtros.fechaInicio || '')
      .set('endDate', filtros.fechaFin || '')
      .set('liquidationID', '')
      .set('page', '')
      .set('status', '')
      .set('searchBy', '')
      .set('rootNodeID', rootNodeID);

    return this.http.get(`${this.apiV1Url}operations/searchOperations`, { headers, params });
  }

  // Ver ticket
  verTicket(data: TicketRequest): Observable<TicketResponse> {
    const terminalId = String(data.terminalId ?? '');
    const token = localStorage.getItem('token') || '';
    const body = {
      terminalId,
      rrcext: data.rrcext || '',
      authorizationNumber: data.authorizationNumber || '',
      authorizationId: String(data.authorizationId ?? ''),
      user: data.user || '',
      context: String(data.context ?? '')
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'versionApp': '3',
      'Entity-i': 'com.sub.tecs',
      'terminalId': terminalId,
      'Authorization': `Bearer ${token}`,
      'AuthorizationToken': `Bearer ${token}`
    });

    return this.http.post<TicketResponse>(`${this.baseUrlTicket}voucher`, body, { headers });
  }

  private getRootNodeID(filtros: FiltrosTransaccion): string {
    const selectedValues = [
      filtros.caja,
      filtros.sucursal,
      filtros.entidad,
      filtros.subafiliado
    ];

    for (const value of selectedValues) {
      const nodeID = this.getNodeID(value);
      if (nodeID) return nodeID;
    }

    return localStorage.getItem('nodeID') || '';
  }

  private getNodeID(value?: string): string {
    if (!value) return '';
    const [, nodeID] = value.split('|');
    return nodeID || value;
  }
}
