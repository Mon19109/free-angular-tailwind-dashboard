import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';
//import { AuthService, UserSessionData } from '../services/auth.service';



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

  //user: UserSessionData | null = null;

  constructor(private http: HttpClient) { }

  private getSession(): any {
    const rawSession = localStorage.getItem('auth_session');
    return rawSession ? JSON.parse(rawSession) : {};
  }

  private getEntityId(): string {
    const session = this.getSession();
    const idBusinessModel = Number(session.idBusinessModel || 0);

    if (idBusinessModel === 1) {
      return session.issueId;
    }

    if (idBusinessModel === 2 || idBusinessModel === 3) {
      return session.acquiringId;
    }

    return session.issueId || session.acquiringId;
  }
  
  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  getBalanceSirio(): Observable<any>{
    
    const session = this.getSession();
    const entS = this.getEntityId();
    /*
    return this.http.get<BalanceResponse>(
          `${this.wsSaldos}getBalance/${entS}`,
          { headers }
        ).pipe(
          catchError(() => of({ virtualAccount: '' }))
        );
    */

    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    if(session.reserveId){ 
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}?includeSB=true`,{ headers });
    }else{
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}`,{ headers });
    }
  }

  getBalanceAhorro(): Observable<any>{
    const session = this.getSession();
    const entS = this.getEntityId();
   
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    if(session.reserveId){ 
      return this.http.get<any>(`${this.apiUrl}getBalance/${entS}?includeSB=true`,{ headers });
    }else{
      return of([]);
    }
  }


  getBalanceAldebaran(): Observable<any>{
    
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');
    return this.http.get<any>(`${this.apiUrlAlde}getBalance/${this.getSession().issueId}`);
  }

  getReport(): Observable<any>{
    
    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');

    const entS = this.getEntityId();

    return this.http.get<any>(`${this.apiUrl}${entS}/getTotalsReport`);
  }




  
  
  
 
  
}
