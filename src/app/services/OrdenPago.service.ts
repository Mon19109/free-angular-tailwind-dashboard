import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

    private getBearerHeaders(): HttpHeaders {
        const token = this.getStoredToken();

        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        });
    }

    private getStoredToken(): string {
        const rawSession = localStorage.getItem('auth_session');

        if (rawSession) {
            try {
                const session = JSON.parse(rawSession);
                if (session?.token) return session.token;
            } catch {
                localStorage.removeItem('auth_session');
            }
        }

        return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
    }


    obtenerContactos(idUser: string): Observable<any> {
        const url = `${this.baseUrl}api/v1/svc-8a7f3c/v2/h7q2_x91`;
        const params = new HttpParams()
            .set('idUser', idUser)
            .set('type', 'TR');

        console.log('GET beneficiarios:', url);

        return this.http.get(
            url,
            {
                headers: this.getBearerHeaders(),
                params
            }
        );

    }

    obtenerCuentas(entitySonID: string): Observable<any> {

        return this.http.get(
            `${this.baseUrl}api/v1/account/getConcentratorAccounts?sirioId=${entitySonID}`,
            {
                headers: this.getBearerHeaders()
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
                headers: this.getBearerHeaders()
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

        const referenciaNumerica = String(data.referencia || this.generarCadena('1234567890', 6));
        const cuentaBeneficiaria = String(data.accountNumber || '') === '0'
            ? data.cuenta
            : data.accountNumber || data.cuenta;
        const body = {

            type: Number(data.idIns) === 40903 ? 4 : 1,

            amount: Number(data.importe),

            currency: {
                id: 484
            },

            numericReference: referenciaNumerica,

            alphanumericReference: this.generarCadena('1234567890abcdefghijklmnopqrstuvwxyz', 6),

            targetName: data.titular,

            targetID: cuentaBeneficiaria,

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

    private generarCadena(caracteres: string, longitud: number): string {
        return Array.from(
            { length: longitud },
            () => caracteres.charAt(Math.floor(Math.random() * caracteres.length))
        ).join('');
    }

    enviarToken(guid: string): Observable<any> {
        return this.http.post(
            `${this.baseUrl}api/v1/c8m4/kwt/f3a91`,
            {
                guid,
                id: '1'
            },
            {
                headers: this.getBearerHeaders()
            }
        );
    }

    validarToken(token: string, userGuid: string): Observable<any> {
        const headers = this.getBearerHeaders().set('versionApp', '3');

        return this.http.post(
            `${this.baseUrl}api/v1/c8m4-r7k-/v2/f3a917`,
            {
                userGuid,
                idOperationType: 1,
                token
            },
            { headers }
        );
    }

}
