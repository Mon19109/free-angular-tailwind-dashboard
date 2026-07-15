import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environments';

export interface FiltrosCaja {
  subafiliado?: string;
  entidad?: string;
  sucursal?: string;
  rfc?: string;
  email?: string;
  tel?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CajasService {
  private baseUrl = environment.api.kashpay;
  private apiV1Url = `${this.baseUrl}api/v1/`;

  constructor(private http: HttpClient) {}

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  getSubafiliados(): Observable<any> {
    return this.http.get(
      `${this.apiV1Url}subAffiliation/getAll`,
      { headers: this.getCommonHeaders() }
    );
  }

  getSubafiliadoById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiV1Url}subAffiliation/getById?idSubAffiliation=${id}`,
      { headers: this.getCommonHeaders() }
    );
  }

  getEntidades(subafiliadoId: number): Observable<any> {
    return this.http.get(
      `${this.apiV1Url}entity/getEntitiesBySubAffiliation?idSubAffiliation=${subafiliadoId}`,
      { headers: this.getCommonHeaders() }
    );
  }

  getSucursales(subafiliadoId: number, entidadId: number): Observable<any> {
    return this.http.get(
      `${this.apiV1Url}branchOffice/getBranchOfficeByAffiliationAndEntity?idSubAffiliation=${subafiliadoId}&idEntity=${entidadId}`,
      { headers: this.getCommonHeaders() }
    );
  }

  buscarCajas(filtros: FiltrosCaja): Observable<any> {
    const prefijo = filtros.subafiliado ? 'SUB' : '';
    const sirioId = `${prefijo}${this.emptyParam(filtros.subafiliado)}${this.emptyParam(filtros.entidad)}${this.emptyParam(filtros.sucursal)}`;

    const params = new HttpParams()
      .set('sirioId', sirioId)
      .set('level', '6')
      .set('nameCommerce', '')
      .set('bussinessName', '')
      .set('email', this.emptyParam(filtros.email))
      .set('telefono', this.emptyParam(filtros.tel))
      .set('rfc', this.emptyParam(filtros.rfc))
      .set('startDate', this.emptyParam(filtros.fechaInicio))
      .set('endDate', this.emptyParam(filtros.fechaFin));

    return this.http.get(
      `${this.apiV1Url}entity/searchCommercesByLevel`,
      {
        headers: this.getCommonHeaders(),
        params
      }
    );
  }

  private emptyParam(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }
}
