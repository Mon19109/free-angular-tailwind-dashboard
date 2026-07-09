import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environments';

@Injectable({
    providedIn: 'root'
})
export class OrdenPagoService {
    private baseUrl = environment.api.kashpay;

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
        const url = `/api-antaresv2.kashplataforma.com/api/v2/antares.kwt-v2.2.10/api/v1/contact/getContacts?idUser=${idUser}&type=TR`;
        console.log('GET beneficiarios:', url);

        return this.http.get(
            url,
            {
                headers: this.getCommonHeaders()
            }
        );

    }

    obtenerCuentas(entitySonID: string): Observable<any> {

        return this.http.get(
            `${this.baseUrl}api/v1/account/getConcentratorAccounts?sirioId=${entitySonID}`,
            {
                headers: this.getCommonHeaders()
            }
        );

    }
    buscarInstitucion(cuenta: string): Observable<any> {

        return this.http.get(
            `/kwt-a7f2-v1.3.2/getInstitutions?value=${cuenta}`,
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
            `${this.baseUrl}api/v1/contact`,
            data,
            {
                headers: this.getCommonHeaders()
            }
        );

    }

    /*realizarSpei(data: any): Observable<any> {
   
     console.log(
       'REQUEST OPERACION',
       JSON.stringify(data, null, 2)
     );
   
     return this.http.post(
       `/Entities/entities/${data.cuentaOr}/operations`,
       data,
       {
         headers: this.getCommonHeaders()
       }
     );
   
   }*/

    realizarSpei(data: any): Observable<any> {

        console.log(
            'DATA RECIBIDA SERVICE',
            data
        );

        const body = {

            type: data.idIns === 40903 ? 4 : 1,

            amount: Number(data.importe),

            currency: {
                id: 484
            },

            numericReference: data.referencia,

            alphanumericReference:
                Math.random().toString(36).substring(2, 8),

            targetName: data.titular,

            targetID: data.accountNumber,

            target_origin_ID: data.cuentaOr,

            targetIDCode: data.idIns,

            targetEmail: 'support@onsigna.com',

            description: data.concepto,

            observation: data.mail,

            status: 0,

            citi: false,

            credit: false

        };

        console.log(
            'REQUEST OPERACION',
            JSON.stringify(body, null, 2)
        );

        return this.http.post(
            `/Entities/entities/${encodeURIComponent(data.cuentaOr)}/operations`,
            body,
            {
                headers: this.getCommonHeaders()
            }
        );

    }

   enviarToken(idUser: number): Observable<any> {

  const body = {
    idUser: String(idUser),
    id: '1'
  };

  return this.http.post(
    `${this.baseUrl}api/v1/user/sendOperationTokenBySMS`,
    body,
    {
      headers: this.getCommonHeaders()
    }
  );
}

 validarToken(
  token: string,
  idUser: number
): Observable<any> {

  return this.http.get(
    `${this.baseUrl}api/v1/user/validateOperationWithSMSToken?idUser=${idUser}&idOperationType=1&token=${token}`
  );

}

}
