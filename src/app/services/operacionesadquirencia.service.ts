import { obtenerNodoSesion } from '../shared/utils/nodo-sesion';
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, EMPTY, expand, reduce, throwError } from 'rxjs';
import { leerPaginaOperaciones } from '../shared/utils/pagina-operaciones';
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
  idSirioConsulta?: string;
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

/** El árbol nuevo entrega idSirio; el PHP recibía la cuenta en account. */
export function cuentaAdquirencia(nodo: any): string {
  for (const valor of [nodo?.idSirio, nodo?.account, nodo?.acquiringId]) {
    const cuenta = String(valor ?? '').trim();
    if (cuenta && cuenta !== '0') return cuenta;
  }
  return '';
}

@Injectable({
  providedIn: 'root'
})
export class OperacionesAdquirenciaService {
  private readonly sessionAuth = inject(AuthService);
  private apiAldebaran = environment.api.aldebaran;
  private baseUrl = environment.api.kashpay;
  private apiSaldos = environment.api.saldos;
  private baseUrlTicket = environment.api.voucher;
  private apiV1Url = `${this.baseUrl}api/v1/`;

  
  constructor(private http: HttpClient) { }

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  private getBearerHeaders(): HttpHeaders {
    const token = this.getStoredToken();

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  private getStoredToken(): string {
    return this.sessionAuth.getToken() || '';
  }
  /**
   * Obtiene la lista de cuentas del API
   */

  /*obtenerCuentas(): Observable<Cuenta[]> {
    //const headers = this.getCommonHeaders();
    
    return this.http.get<any>(`${this.apiAldebaran}getEntityLevels?fatherId=${this.sessionAuth.getSessionValue('issueId') || ''}&level=`);
        
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
    `/api/operaciones-adquirencia/tipos-operacion`,
    {
      headers: this.getBearerHeaders().set('versionApp', '3')
    }
  );

}

  getSubafiliados(): Observable<{ contextResponse: Subafiliado[] }> {
      const nodeID = obtenerNodoSesion(this.sessionAuth);

      if (nodeID) {
        return this.http.get<{ contextResponse: Subafiliado[] }>(
          `/api/operaciones-adquirencia/nodos/${encodeURIComponent(nodeID)}/arbol?levels=3`,
          { headers: this.getBearerHeaders() }
        );
      }

      return this.http.get<{ contextResponse: Subafiliado[] }>(
        `/api/operaciones-adquirencia/subafiliados`,
        { headers: this.getBearerHeaders() }
      );
    }
  
    getSubafiliadoById(): Observable<any> {
      const nodeID = obtenerNodoSesion(this.sessionAuth);

      return this.http.get<any>(
        `/api/operaciones-adquirencia/nodos/${encodeURIComponent(nodeID)}/arbol?levels=3`,
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
    `/api/operaciones-adquirencia/nodos/${encodeURIComponent(nodeID)}/arbol?levels=4`,
    {
      headers: this.getBearerHeaders()
    }
  );

}
  
    getSucursales(nodeID: string): Observable<any> {
      return this.http.get(
        `/api/operaciones-adquirencia/nodos/${encodeURIComponent(nodeID)}/arbol?levels=5`,
        { headers: this.getBearerHeaders() }
      );
    }
  
    getCajas(nodeID: string): Observable<any> {
      return this.http.get(
        `/api/operaciones-adquirencia/nodos/${encodeURIComponent(nodeID)}/arbol?levels=6`,
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

    return this.http.get<any>(`/api/operaciones-adquirencia/estatus`);

    
  }

  /**
   * Envía los datos del formulario al API
   * @param formData Datos del formulario
   */
  obtenerCuentaSesion(): string {
    return cuentaAdquirencia({ acquiringId: this.sessionAuth.getSessionValue('acquiringId') });
  }

  enviarFormulario(formData: FormularioData, page = 0): Observable<any> {
    const validate = formData.idSirioConsulta || this.obtenerCuentaSesion();
    if (!validate || validate === '0') {
      return throwError(() => new Error('No hay una cuenta de adquirencia válida.'));
    }

    let params = new HttpParams()
      .set('type', this.emptyParam(formData.tipoOperacion))
      .set('status', this.emptyParam(formData.estatus))
      .set('page', page)
      .set('size', '10')
      .set('dateInit', this.emptyParam(formData.fechaInicio))
      .set('dateFinish', this.emptyParam(formData.fechaFin));

    return this.http.get(
      `/api/operaciones-adquirencia/cuentas/${encodeURIComponent(validate)}/operaciones`,
      {
        headers: this.getCommonHeaders(),
        params
      }
    );
  }

  obtenerTodasOperaciones(filtros: FormularioData): Observable<any[]> {
    const cargar = (pagina: number) => this.enviarFormulario(filtros, pagina - 1).pipe(
      map(response => {
        const body = response?.response ?? response?.rows ?? response;
        const filas = Array.isArray(body) ? body : body?.operations ?? body?.content;
        if (response?.success === false || (!Array.isArray(filas) && !(filas === 0 && Number(body?.totalElements ?? body?.totalItems) === 0))) {
          throw new Error('Respuesta inválida al exportar operaciones');
        }
        return { pagina, ...leerPaginaOperaciones(response, pagina) };
      })
    );
    return cargar(1).pipe(
      expand(resultado => resultado.siguiente ? cargar(resultado.pagina + 1) : EMPTY, 1),
      reduce((filas: any[], resultado) => { filas.push(...resultado.operaciones); return filas; }, [])
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
    
    return this.http.get(`/api/operaciones-adquirencia/consultas`, { params });
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
      'Accept': 'application/json'
    });

    return this.http.post<TicketResponse>(`/api/operaciones-adquirencia/ticket`, body, { headers });
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
