import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrdenPagoService {
  private readonly base = '/api/orden-pago';
  private readonly escritura = { withCredentials: true, headers: { 'X-Portal-Request': '1' } };
  constructor(private http: HttpClient) {}
  obtenerContactos(): Observable<any> {
    return this.http.get(`${this.base}/contactos`, { withCredentials: true });
  }
  obtenerCuentas(): Observable<any> {
    return this.http.get(`${this.base}/cuentas`, { withCredentials: true });
  }
  buscarInstitucion(cuenta: string): Observable<any> {
    return this.http.get(`${this.base}/instituciones`, { params: new HttpParams().set('value', cuenta), withCredentials: true });
  }
  obtenerSaldo(idSirio: string): Observable<{ balance: number }> {
    return this.http.get<{ balance?: unknown; success?: boolean }>(`${this.base}/saldo/${encodeURIComponent(idSirio)}`, {
      withCredentials: true
    }).pipe(map(response => {
      const value = response?.balance;
      if (response?.success === false ||
          !((typeof value === 'number') || (typeof value === 'string' && value.trim() !== '')) ||
          !Number.isFinite(Number(value))) throw new Error('Respuesta de saldo no válida');
      return { balance: Number(value) };
    }));
  }
  agregarContacto(data: any): Observable<any> { return this.http.post(`${this.base}/contactos`, data, this.escritura); }
  realizarSpei(data: any): Observable<any> { return this.http.post(`${this.base}/spei`, data, this.escritura); }
  enviarToken(): Observable<any> { return this.http.post(`${this.base}/enviar-token`, {}, this.escritura); }
  validarToken(token: string): Observable<any> {
    return this.http.post(`${this.base}/validar-token`, { token }, this.escritura);
  }
}
