import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class BeneficiariosService {
  private baseUrl = environment.api.kashpay;
  private apiV1Url = `${this.baseUrl}api/v1/`;
  private aldebaranUrl = environment.api.aldebaran;

  constructor(private http: HttpClient) {}

  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.getStoredToken()}`,
      'versionApp': '3'
    });
  }

  obtenerContactos(idUser: string, type = 'TR'): Observable<any> {
    const params = new HttpParams()
      .set('idUser', idUser)
      .set('type', type);

    return this.http.get(`${this.apiV1Url}svc-8a7f3c/v2/h7q2_x91`, {
      headers: this.getCommonHeaders(),
      params
    });
  }

  private getStoredToken(): string {
    const sessionRaw = localStorage.getItem('auth_session');

    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session?.token) return String(session.token);
      } catch {
        // Se usan las llaves individuales como respaldo.
      }
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }

  obtenerGiros(): Observable<any> {
    return this.http.get(`${this.apiV1Url}getGiros`, {
      headers: this.getCommonHeaders()
    });
  }

  obtenerActividades(): Observable<any> {
    return this.http.get(`${this.apiV1Url}getActividades`, {
      headers: this.getCommonHeaders()
    });
  }

  buscarInstitucion(cuenta: string): Observable<any> {
    const params = new HttpParams().set('value', cuenta);

    return this.http.get(`${this.aldebaranUrl}getInstitutions`, {
      params
    });
  }

  agregarContacto(idUser: number, form: BeneficiarioForm): Observable<any> {
    const giro = form.tipoBen === 'PM' ? `${form.giro}|${form.desGiro}` : '';
    const body = {
      idUser,
      nameAlias: form.alias,
      cardNumberMask: form.cuenta,
      numberPhone: 'ND',
      typeRegister: 'TR',
      email: form.email,
      typeTransfer: 1,
      fullName: form.nombre,
      nameInstitution: form.nameIns,
      idInstitution: Number(form.institucion),
      typeAccount: form.tipoCuenta,
      razonSocial: '',
      intenationalCode: '',
      street: '',
      exteriorNumber: '',
      interiorNumber: '',
      aditionalReference: '',
      postalCode: '',
      city: '',
      state: '',
      accountNumber: form.accountNumber || form.cuenta,
      beneficiaryType: form.tipoBen,
      show: true,
      aditionalData: {
        addressBank: {
          street: form.dirBanco
        },
        beneficiaryAddress: {
          street: form.direccion
        },
        aditionalReferences: ['', '', ''],
        destinationCountry: '',
        intermediaryBank: '',
        bankName: form.nameIns,
        bankPhone: form.telefono,
        bankEmail: form.emailB,
        currency: 'MX',
        businessLine: giro,
        businessActivity: form.actividad,
        typeAccount: '',
        accountNumber: ''
      }
    };

    return this.http.post(`${this.apiV1Url}contact`, body, {
      headers: this.getCommonHeaders()
    });
  }

  eliminarContactos(ids: Array<string | number>): Observable<any> {
    const params = new HttpParams().set('contactIds', ids.join(','));

    return this.http.delete(`${this.apiV1Url}contact/deleteContacts`, {
      headers: this.getCommonHeaders(),
      params
    });
  }

  consultarEstatus(fileKey: string): Observable<any> {
    const params = new HttpParams().set('fileKey', fileKey);

    return this.http.get(`${this.apiV1Url}contact/getDetailContactFile`, {
      headers: this.getCommonHeaders(),
      params
    });
  }
}
