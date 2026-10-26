import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
export interface Entidad { bundle: number; bussinesName: string; }
export interface FormularioData { entidad: string; typeSearch: string; value1F: string; value2F: string; size: number; pages: number; }
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly url = '/api/usuarios';
  constructor(private http: HttpClient) {}
  obtenerEntidades(): Observable<any[]> { return this.http.get<any[]>(`${this.url}/entidades`, {withCredentials:true}); }
  enviarFormulario(formData: FormularioData, page = 1): Observable<any> { return this.http.post(`${this.url}/buscar`, {...formData,page}, {withCredentials:true}); }
  enviarFormularioComoParams(formData: FormularioData): Observable<any> { return this.http.post(`${this.url}/buscar-params`, formData, {withCredentials:true}); }
  updateEmail(idUser: string | number, emailOrigin: string, emailUpdate: string): Observable<any> { return this.http.post(`${this.url}/actualizar-email`, {idUser,emailOrigin,emailUpdate}, {withCredentials:true}); }
  sendToken(contexto: string | number, email: string, dni: string | number): Observable<any> { return this.http.post(`${this.url}/enviar-token`, {contexto,email,dni}, {withCredentials:true}); }
  blockUser(idUser: string | number, contexto: string | number): Observable<any> { return this.http.post(`${this.url}/bloquear`, {idUser,contexto}, {withCredentials:true}); }
}
