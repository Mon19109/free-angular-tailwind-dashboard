import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PreregistroCatalogosHttpService } from './preregistro-catalogos-http.service';
import { environment } from '../environments/environments';

export interface BeneficiarioForm {
  nombre: string;
  alias: string;
  email: string;
  rfc: string;
  direccion: string;
  tipoBen: 'PF' | 'PM';
  giro: string;
  desGiro: string;
  actividad: string;
  tipoCuenta: string;
  cuenta: string;
  institucion: string;
  nameIns: string;
  accountNumber: string;
  dirBanco: string;
  telefono: string;
  emailB: string;
}

@Injectable({ providedIn: 'root' })
export class BeneficiariosService {
  private readonly http = inject(HttpClient);
  private readonly catalogosPublicos = inject(PreregistroCatalogosHttpService);
  private readonly base = '/api/beneficiarios';

  obtenerContactos(idUser: string, type = 'TR'): Observable<any> {
    return this.http.get(`${this.base}/contactos`, { params: new HttpParams().set('idUser', idUser).set('type', type) });
  }
  obtenerGiros(): Observable<any> { return this.http.get(`${this.base}/giros`); }
  obtenerActividades(): Observable<any> { return this.http.get(`${this.base}/actividades`); }
  buscarInstitucion(cuenta: string, bearerToken?: string, preregistroPublico = false): Observable<any> {
    const params = new HttpParams().set('value', cuenta);
    // Mantiene la ruta de prerregistro publico ya existente; no envia bearerToken al navegador/BFF.
    if (preregistroPublico) return this.catalogosPublicos.get<any>(environment.preregistroBff.institucionesUrl, params);
    return this.http.get(`${this.base}/instituciones`, { params });
  }
  agregarContacto(idUser: number, form: BeneficiarioForm): Observable<any> {
    return this.http.post(`${this.base}/contactos`, { idUser, form });
  }
  eliminarContactos(ids: Array<string | number>): Observable<any> {
    return this.http.delete(`${this.base}/contactos`, { params: new HttpParams().set('contactIds', ids.join(',')) });
  }
  consultarEstatus(fileKey: string): Observable<any> {
    return this.http.get(`${this.base}/estatus`, { params: new HttpParams().set('fileKey', fileKey) });
  }
}
