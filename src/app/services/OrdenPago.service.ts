import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class OrdenPagoService {

  constructor(
    private http: HttpClient
  ) { }


private getCommonHeaders(): HttpHeaders {

  return new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Basic YWRtaW46c2VjcmV0'
  });

}


  obtenerContactos(idUser: number): Observable<any> {

  return this.http.get(
    `/portalKashPayServices/api/v1/contact/getContacts?idUser=${idUser}&type=TR`,
    {
      headers: this.getCommonHeaders()
    }
  );

}

  obtenerCuentas(entitySonID: string): Observable<any> {

  return this.http.get(
    `/portalKashPayServices/api/v1/account/getConcentratorAccounts?sirioId=${entitySonID}`,
    {
      headers: this.getCommonHeaders()
    }
  );

}
  buscarInstitucion(cuenta: string): Observable<any> {

  return this.http.get(
    `/AldebaranServices/getInstitutions?value=${cuenta}`,
    {
      headers: this.getCommonHeaders()
    }
  );

}

  /*obtenerSaldo(cuentaOr: string): Observable<any> {

  return this.http.get(
    `/Entities/entities/${cuentaOr}`,
    {
      headers: this.getCommonHeaders()
    }
  );

}*/

obtenerSaldo(idSirio: string): Observable<any> {

  return this.http.get(
    `/Entities/entities/getBalance/${idSirio}`
  );

}

 agregarContacto(data: any): Observable<any> {

  return this.http.post(
    `/portalKashPayServices/api/v1/contact`,
    data,
    {
      headers: this.getCommonHeaders()
    }
  );

}

 realizarSpei(data: any): Observable<any> {

  return this.http.post(
    `/Entities/entities/${data.cuentaOr}/operations`,
    data,
    {
      headers: this.getCommonHeaders()
    }
  );

}

  enviarToken(): Observable<any> {

    return this.http.post(
      `/portalKashPayServices/api/v1/user/sendOperationTokenBySMS`,
      {}
    );

  }

  validarToken(token: string): Observable<any> {

    return this.http.get(
      `/portalKashPayServices/api/v1/user/validateOperationWithSMSToken?token=${token}`
    );

  }

}