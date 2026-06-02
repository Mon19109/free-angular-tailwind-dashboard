import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
import { AuthService, UserSessionData } from '../services/auth.service';



export interface BalanceSirioResponse {
  balance: number;
  saldoD: number;
  SaldoP: number;
  name: string;
}

export interface BalanceAhorroResponse {
  balance: number;
  saldoD: number;
  SaldoP: number;
  name: string;
}
export interface BalanceAldebaranResponse {
  balance: number;
  saldoD: number;
  SaldoP: number;
  name: string;
}
export interface ReportesResponse {
  balance: number;
  saldoD: number;
  SaldoP: number;
  name: string;
}
@Injectable({
  providedIn: 'root',
})


export class DashboardService {
  
  private apiUrl = environment.api.saldos; 
  private apiUrlAlde = environment.api.aldebaran; 

  user: UserSessionData | null = null;

  constructor(private http: HttpClient) { }
  
  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  getBalanceSirio(): Observable<any>{
    
    var entS;

    if (localStorage.getItem('idBusinessModel') == '1') {
      entS = localStorage.getItem('issueId');
    }else  if (localStorage.getItem('idBusinessModel') == '3') {
      entS = localStorage.getItem('acquiringId');
    }else if (localStorage.getItem('idBusinessModel') == '2') {
      entS = localStorage.getItem('acquiringId');
    }
    /*
    return this.http.get<BalanceResponse>(
          `${this.wsSaldos}getBalance/${entS}`,
          { headers }
        ).pipe(
          catchError(() => of({ virtualAccount: '' }))
        );
    */

        
      console.log('kk='+localStorage.getItem('reserveId'));
   
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    if(localStorage.getItem('reserveId') != ''){ 
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}?includeSB=true`,{ headers });
    }else{
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}`,{ headers });
    }
  }

  getBalanceAhorro(): Observable<any>{
    
    var entS;

    if (localStorage.getItem('idBusinessModel') == '1') {
      entS = localStorage.getItem('issueId');
    }else  if (localStorage.getItem('idBusinessModel') == '3') {
      entS = localStorage.getItem('acquiringId');
    }else if (localStorage.getItem('idBusinessModel') == '2') {
      entS = localStorage.getItem('acquiringId');
    }
  
    console.log('aaaa='+localStorage.getItem('idBusinessModel'));
   
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    if(localStorage.getItem('reserveId') != ''){ 
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}?includeSB=true`,{ headers });
    }else{
      return this.http.get<any>('');
    }
  }


  getBalanceAldebaran(): Observable<any>{
    
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    return this.http.get<any>(`${this.apiUrlAlde}getBalance/${localStorage.getItem('issueId')}`);
  }

  getReport(): Observable<any>{
    
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');

    var entS;

    if (localStorage.getItem('idBusinessModel') == '1') {
      entS = localStorage.getItem('issueId');
    }else  if (localStorage.getItem('idBusinessModel') == '3') {
      entS = localStorage.getItem('acquiringId');
    }else if (localStorage.getItem('idBusinessModel') == '2') {
      entS = localStorage.getItem('acquiringId');
     }

    return this.http.get<any>(`${this.apiUrl}${entS}/getTotalsReport`);
  }




  
  
  
 
  
}
