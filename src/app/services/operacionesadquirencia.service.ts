import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';

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

export interface Subafiliado {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Entidad {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Sucursal {
  id: number;
  nombre: string;
  descripcion: string;
  codigo: string;
}

export interface Caja {
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
  entidad?: string;
  sucursal?: string;
  caja?: string;
  clasificacion?: string;
  idEntidad?: string;
  idSucursal?: string;
  idSubafiliado?: string;
  idCaja?: string;
  monto?: number | string;
  numAuto?: string;
  email?: string;
  tel?: string;
  estatus?: string | string[];
  tipoOperacion?: string | string[];
  fechaInicio?: string;
  fechaFin?: string;
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

@Injectable({
  providedIn: 'root'
})
export class OperacionesAdquirenciaService {
  private apiAldebaran = environment.api.aldebaran;
  private baseUrl = environment.api.kashpay;
  private apiSaldos = environment.api.saldos;
  private baseUrlTicket = environment.api.voucher;
  private apiV1Url = `${this.baseUrl}api/v1/`;
  //private cuen = localStorage.getItem('issueId');

  
  constructor(private http: HttpClient) { }

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  private getBearerHeaders(): HttpHeaders {
    const token = this.getStoredToken();

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private getStoredToken(): string {
    const rawSession = localStorage.getItem('auth_session');

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        if (session?.token) return session.token;
      } catch {
        localStorage.removeItem('auth_session');
      }
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }
  /**
   * Obtiene la lista de cuentas del API
   */

  /*obtenerCuentas(): Observable<Cuenta[]> {
    //const headers = this.getCommonHeaders();
    
    return this.http.get<any>(`${this.apiAldebaran}getEntityLevels?fatherId=${localStorage.getItem('issueId')}&level=`);
        
  }*/




  obtenerCuentas(): Observable<any> {
    return this.getSubafiliados();
  }

  /**
   * Obtiene la lista de tipos de operación del API
   */
  /*obtenerTiposOperacion(): Observable<TipoOperacion[]> {
    const headers = this.getCommonHeaders();
    return this.http.post<any>(`${this.baseUrl}catOperationType/getAll`, { 
      headers: headers,
      withCredentials: true
    }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta operatipo:', response))
    );
    
    
  }*/

    obtenerTiposOperacion(): Observable<any> {

  return this.http.get<any>(
    `${this.apiV1Url}catOperationType/getAll`,
    {
      headers: this.getBearerHeaders()
    }
  );

}

  getSubafiliados(): Observable<{ contextResponse: Subafiliado[] }> {
      const nodeID = localStorage.getItem('nodeID') || '';

      if (nodeID) {
        return this.http.get<{ contextResponse: Subafiliado[] }>(
          `${this.baseUrl}api/nodes/${nodeID}/tree?levels=3`,
          { headers: this.getBearerHeaders() }
        );
      }

      return this.http.get<{ contextResponse: Subafiliado[] }>(
        `${this.apiV1Url}subAffiliation/getAll`,
        { headers: this.getBearerHeaders() }
      );
    }
  
    getSubafiliadoById(): Observable<any> {
      const nodeID = localStorage.getItem('nodeID') || '';

      return this.http.get<any>(
        `${this.baseUrl}api/nodes/${nodeID}/tree?levels=3`,
        { headers: this.getBearerHeaders() }
      );
    }
  
    /*getSubafiliados(): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/getSubafiliados`);
    }*/
  
    /*getEntidades(subafiliadoId: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/transacciones/searchEntidad/${subafiliadoId}`);
    }*/
  getEntidades(nodeID: string): Observable<any> {

  return this.http.get(
    `${this.baseUrl}api/nodes/${nodeID}/tree?levels=4`,
    {
      headers: this.getBearerHeaders()
    }
  );

}
  
    getSucursales(nodeID: string): Observable<any> {
      return this.http.get(
        `${this.baseUrl}api/nodes/${nodeID}/tree?levels=5`,
        { headers: this.getBearerHeaders() }
      );
    }
  
    getCajas(nodeID: string): Observable<any> {
      return this.http.get(
        `${this.baseUrl}api/nodes/${nodeID}/tree?levels=6`,
        { headers: this.getBearerHeaders() }
      );
    }
//ESE SERVCIO ES DE PHP 
/*getSucursales(subafiliadoId:number, entidadId:number) {
  return this.http.get(
    `${this.baseUrl}branchOffice/getBranchOfficeByAffiliationAndEntity?idSubAffiliation=${subafiliadoId}&idEntity=${entidadId}`,
    { headers: this.getCommonHeaders() }
  );
}

getCajas(idTerminal:number) {
  return this.http.get(
    `${this.baseUrl}collaborator/getCollaboratorByBranchOffice?idTerminal=${idTerminal}`,
    { headers: this.getCommonHeaders() }
  );
}
*/





  obtenerStatus(): Observable<Status[]> {

    return this.http.get<any>(`${this.apiAldebaran}catStatusOperations`);

    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  enviarFormulario(formData: FormularioData): Observable<any> {
    const validate = localStorage.getItem('acquiringId')
      || localStorage.getItem('validate')
      || localStorage.getItem('issueId')
      || '';

    let params = new HttpParams()
      .set('type', this.emptyParam(formData.tipoOperacion))
      .set('status', this.emptyParam(formData.estatus))
      .set('page', '0')
      .set('size', '10')
      .set('dateInit', this.emptyParam(formData.fechaInicio))
      .set('dateFinish', this.emptyParam(formData.fechaFin));

    return this.http.get(
      `${this.apiSaldos}${encodeURIComponent(validate)}/getoperationbytypeandstatuscustom`,
      {
        headers: this.getCommonHeaders(),
        params
      }
    );
  }

  /**
   * Método alternativo para enviar formulario con parámetros query
   * @param formData Datos del formulario
   */
  enviarFormularioComoParams(formData: FormularioData): Observable<any> {
    let params = new HttpParams();
    
    if (formData.cuenta) params = params.set('cuenta', formData.cuenta);
    if (formData.estatus) params = params.set('estatus', this.emptyParam(formData.estatus));
    if (formData.tipoOperacion) params = params.set('tipoOperacion', this.emptyParam(formData.tipoOperacion));
    if (formData.fechaInicio) params = params.set('fechaInicio', formData.fechaInicio);
    if (formData.fechaFin) params = params.set('fechaFin', formData.fechaFin);
    
    return this.http.get(`${this.apiAldebaran}/consultas`, { params });
  }

  verTicket(data: TicketRequest): Observable<TicketResponse> {
    const terminalId = String(data.terminalId ?? '');
    const token = this.getStoredToken();
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

  private emptyParam(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  }

  private setOptionalParam(params: HttpParams, key: string, value: unknown): HttpParams {
    const normalized = this.emptyParam(value).trim();
    return normalized ? params.set(key, normalized) : params;
  }
}
