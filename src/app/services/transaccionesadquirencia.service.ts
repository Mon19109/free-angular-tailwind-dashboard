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

  getSubafiliadoById(id: number): Observable<any> {
    const headers = this.getCommonHeaders();

    return this.http.get<any>(
      `${this.apiV1Url}subAffiliation/getById?idSubAffiliation=${id}`, { 
          headers: headers,
          withCredentials: true
        }
    );
  }

  /*getSubafiliados(): Observable<any> {
    return this.http.get(`${this.baseUrl}/transacciones/getSubafiliados`);
  }*/

 getEntidades(subafiliadoId: number): Observable<any> {
  const headers = this.getCommonHeaders();

  return this.http.get(
    `${this.apiV1Url}entity/getEntitiesBySubAffiliation?idSubAffiliation=${subafiliadoId}`,
    { headers }
  );
}

  getSucursales(subafiliadoId: number, entidadId: number): Observable<any> {
    const headers = this.getCommonHeaders();

    return this.http.get(
      `${this.apiV1Url}branchOffice/getBranchOfficeByAffiliationAndEntity?idSubAffiliation=${subafiliadoId}&idEntity=${entidadId}`,
      { headers }
    );
  }

  getCajas(idTerminal: number): Observable<any> {
    const headers = this.getCommonHeaders();

    return this.http.get(
      `${this.apiV1Url}collaborator/getCollaboratorByBranchOffice?idTerminal=${idTerminal}`,
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
      .set('amount', (filtros.monto || '').replace(/,/g, ''))
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
  verTicket(data: any): Observable<any> {
    return this.http.post(`${this.baseUrlTicket}/transacciones/verTicket`, data);
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
    return nodeID || '';
  }
}
