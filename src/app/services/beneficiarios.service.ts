import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, defer, of, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
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
  private readonly sessionAuth = inject(AuthService);
  private readonly catalogosPublicos = inject(PreregistroCatalogosHttpService);
  private readonly base = '/api/beneficiarios';
  private readonly headers = { 'X-Portal-Request': '1' };

  obtenerContactos(): Observable<any> {
    return this.http.get(`${this.base}/contactos`, { withCredentials: true, headers: this.headers });
  }
  obtenerGiros(): Observable<any> { return this.http.get(`${this.base}/giros`, { withCredentials: true, headers: this.headers }); }
  obtenerActividades(): Observable<any> { return this.http.get(`${this.base}/actividades`, { withCredentials: true, headers: this.headers }); }
  buscarInstitucion(cuenta: string, bearerToken?: string, preregistroPublico = false): Observable<any> {
    const params = new HttpParams().set('value', cuenta);
    // Mantiene la ruta de prerregistro publico ya existente; no envia bearerToken al navegador/BFF.
    if (preregistroPublico) return this.catalogosPublicos.get<any>(environment.preregistroBff.institucionesUrl, params);
    return this.http.get(`${this.base}/instituciones`, { params });
  }
  agregarContacto(form: BeneficiarioForm): Observable<any> {
    return defer(() => this.sessionAuth.getSessionValue('idUser')
      ? of(null) : this.sessionAuth.validarSesion()).pipe(switchMap(() => {
      const value = this.sessionAuth.getSessionValue('idUser');
      const idUser = Number(value);
      if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(idUser) || idUser < 1) {
        return throwError(() => new Error('No se encontró el usuario en la sesión confirmada por el servidor.'));
      }
      return this.http.post(`${this.base}/contactos`, { idUser, form }, { headers: this.headers, withCredentials: true });
    }));
  }
  eliminarContactos(ids: Array<string | number>): Observable<any> {
    return this.http.delete(`${this.base}/contactos`, { params: new HttpParams().set('contactIds', ids.join(',')), headers: this.headers });
  }
  consultarEstatus(fileKey: string): Observable<any> {
    return this.http.get(`${this.base}/estatus`, { params: new HttpParams().set('fileKey', fileKey), headers: this.headers });
  }
}
