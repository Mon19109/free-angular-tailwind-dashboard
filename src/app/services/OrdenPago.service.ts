import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrdenPagoService {
  private readonly base = '/api/orden-pago';
  constructor(private http: HttpClient) {}
  obtenerContactos(idUser: string): Observable<any> {
    return this.http.get(`${this.base}/contactos`, { params: new HttpParams().set('idUser', idUser) });
  }
  obtenerCuentas(entitySonID: string): Observable<any> {
    return this.http.get(`${this.base}/cuentas`, { params: new HttpParams().set('sirioId', entitySonID) });
  }
  buscarInstitucion(cuenta: string): Observable<any> {
    return this.http.get(`${this.base}/instituciones`, { params: new HttpParams().set('value', cuenta) });
  }
  obtenerSaldo(idSirio: string): Observable<any> {
    return this.http.get(`${this.base}/saldo/${encodeURIComponent(idSirio)}`);
  }
  agregarContacto(data: any): Observable<any> { return this.http.post(`${this.base}/contactos`, data); }
  realizarSpei(data: any): Observable<any> { return this.http.post(`${this.base}/spei`, data); }
  enviarToken(guid: string): Observable<any> { return this.http.post(`${this.base}/enviar-token`, { guid }); }
  validarToken(token: string, userGuid: string): Observable<any> {
    return this.http.post(`${this.base}/validar-token`, { token, userGuid });
  }
}
