// src/app/services/auth.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SESSION_KEY = 'auth_session';
  private isProcessing = false;
  
  private authStatusSubject = new BehaviorSubject<boolean>(this.hasValidSession());
  authStatus$ = this.authStatusSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ============================================
  // MANEJO DE SESIÓN
  // ============================================

  private saveSession(data: any): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(data));
    this.authStatusSubject.next(true);
  }

  private getSession(): any {
    const session = localStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }

  private getSessionValue(key: string): any {
    const session = this.getSession();
    return session ? session[key] : null;
  }

  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    this.authStatusSubject.next(false);
  }

  hasValidSession(): boolean {
    const session = this.getSession();
    return session !== null && session.token !== undefined && session.token !== '';
  }

  getToken(): string | null {
    return this.getSessionValue('token');
  }

  getUserData(): any {
    return this.getSession();
  }

  // ============================================
  // HEADERS
  // ============================================

  private getHeaders(customHeaders?: any): HttpHeaders {
    let headers = new HttpHeaders({
      'Entity-i': 'com.onsigna',
      'Content-Type': 'application/json',
      'versionApp': '3',
      'Cookie': 'JSESSIONID=7550148b68185496a3e8cead36dc'
    });

    if (customHeaders) {
      Object.keys(customHeaders).forEach(key => {
        headers = headers.set(key, customHeaders[key]);
      });
    }

    return headers;
  }

  // ============================================
  // 1. AUTHENTICATE
  // ============================================
  
  authenticate(userLogin: string, passwordLogin: string, latitud: string = '0', longitud: string = '0'): Observable<any> {
    const url = `${environment.api.auth}v2/oauth/authenticate`;
    
    const body = {
      authenticate: {
        user: userLogin,
        password: passwordLogin
      },
      deviceEntity: {
        os: 'Web',
        systemOperativeName: 'Web',
        model: 'Web',
        latitude: latitud,
        longitude: longitud
      },
      appInfo: {
        nameApp: 'Portal Web',
        versionApp: '3',
        enviroment: 'PRODUCCION',
        platform: 'ZDVAU'
      }
    };

    return this.http.post(url, body, { headers: this.getHeaders() });
  }

  // ============================================
  // 2. REGISTER
  // ============================================
  
  register(userLogin: string, passwordLogin: string, latitud: string = '0', longitud: string = '0'): Observable<any> {
    const url = `${environment.api.auth}v2/oauth/register`;
    
    const body = {
      authenticate: {
        user: userLogin,
        password: passwordLogin
      },
      deviceEntity: {
        os: 'Web',
        systemOperativeName: 'Web',
        model: 'Web',
        latitude: latitud,
        longitude: longitud
      },
      appInfo: {
        nameApp: 'Portal Web',
        versionApp: '3',
        enviroment: 'PRODUCCION',
        platform: 'ZDVAU'
      }
    };

    return this.http.post(url, body, { headers: this.getHeaders() });
  }

  // ============================================
  // 3. LOGIN KASPAY
  // ============================================
  
  loginKasPay(userLogin: string, passwordLogin: string, latitud: string, longitud: string, accessToken: string): Observable<any> {
    const url = `${environment.api.kashpay}/api/v1/user/login`;
    
    const body = {
      email: userLogin,
      password: passwordLogin,
      device: {
        os: 'WEB',
        latitude: latitud,
        longitude: longitud
      }
    };

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Cookie': 'JSESSIONID=D85924E31F132B8C77D289A48F1EDFFB'
    };

    return this.http.post(url, body, { headers: this.getHeaders(headers) });
  }

  // ============================================
  // 4. GET BALANCE
  // ============================================
  
  getBalance(accessToken: string, entS: string): Observable<any> {
    const url = `${environment.api.entities}/getBalance`;
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Entity-i': 'com.onsigna',
      'SonEntity-i': entS,
      'versionApp': '3'
    };

    return this.http.get(url, { headers: this.getHeaders(headers) });
  }

  // ============================================
  // 5. SEARCH ACCOUNT - LOGIN COMPLETO
  // ============================================
  
  searchAccount(userLogin: string, passwordLogin: string, latitud: string = '0', longitud: string = '0'): Observable<any> {
    if (this.isProcessing) {
      return throwError(() => new Error('Ya hay una petición en proceso'));
    }

    this.isProcessing = true;

    return this.authenticate(userLogin, passwordLogin, latitud, longitud).pipe(
      switchMap((authResult: any) => {
        // Usuario no existe - Registrar
        if (authResult.success === false && authResult.error?.code === 300) {
          return this.register(userLogin, passwordLogin, latitud, longitud).pipe(
            switchMap((registerResult: any) => {
              return this.authenticate(userLogin, passwordLogin, latitud, longitud).pipe(
                switchMap((authResult2: any) => {
                  if (authResult2.authResponse?.accessToken) {
                    return this.loginKasPay(
                      userLogin,
                      passwordLogin,
                      latitud,
                      longitud,
                      authResult2.authResponse.accessToken
                    ).pipe(
                      switchMap((loginResult: any) => {
                        this.isProcessing = false;
                        if (loginResult.success) {
                          return this.processLoginResponse(loginResult, authResult2, userLogin, latitud, longitud);
                        } else {
                          return throwError(() => ({
                            success: false,
                            idUser: 'L',
                            message: 'No se encontraron resultados',
                            inSession: false
                          }));
                        }
                      })
                    );
                  } else {
                    this.isProcessing = false;
                    return throwError(() => ({
                      success: false,
                      idUser: 'OA-R',
                      message: 'No se encontraron resultados',
                      inSession: false
                    }));
                  }
                })
              );
            })
          );
        } 
        // Usuario existe
        else if (authResult.success === true) {
          const accessToken = authResult.authResponse?.accessToken;
          
          if (!accessToken) {
            this.isProcessing = false;
            return throwError(() => ({
              success: false,
              idUser: 'L',
              message: 'No se encontraron resultados',
              inSession: false
            }));
          }

          return this.loginKasPay(userLogin, passwordLogin, latitud, longitud, accessToken).pipe(
            switchMap((loginResult: any) => {
              this.isProcessing = false;
              if (loginResult.success) {
                return this.processLoginResponse(loginResult, authResult, userLogin, latitud, longitud);
              } else {
                return throwError(() => ({
                  success: false,
                  idUser: 'L',
                  message: 'No se encontraron resultados',
                  inSession: false
                }));
              }
            })
          );
        } 
        else {
          this.isProcessing = false;
          return throwError(() => ({
            success: false,
            idUser: 'AU-AU',
            message: authResult.error?.message || 'Error en autenticación',
            inSession: false
          }));
        }
      }),
      catchError(error => {
        this.isProcessing = false;
        return throwError(() => error);
      })
    );
  }

  // ============================================
  // PROCESAR RESPUESTA DE LOGIN
  // ============================================
  
  private processLoginResponse(loginResult: any, authResult: any, userLogin: string, latitud: string, longitud: string): Observable<any> {
    const terminalInfo = loginResult.terminalInfo;
    const accessToken = authResult.authResponse?.accessToken;

    if (!accessToken) {
      return throwError(() => ({
        success: false,
        idUser: 'L-E-AU',
        message: 'No se encontraron resultados',
        inSession: false
      }));
    }

    // Determinar entidad
    let entS: string;
    if (terminalInfo.idBusinessModel === 1) {
      entS = terminalInfo.issueId;
    } else if (terminalInfo.idBusinessModel === 3 || terminalInfo.idBusinessModel === 2) {
      entS = terminalInfo.acquiringId;
    } else {
      entS = terminalInfo.issueId || terminalInfo.acquiringId;
    }

    return this.getBalance(accessToken, entS).pipe(
      map((balanceResult: any) => {
        const reserveId = terminalInfo.reserveId || '';

        const sessionData = {
          idUser: terminalInfo.userID,
          idContext: terminalInfo.contextID,
          idEntity: terminalInfo.entityID,
          idTerminal: terminalInfo.terminalID,
          idTerminalUser: terminalInfo.terminalUserID,
          idRol: terminalInfo.affiliationLevelID,
          idPerfil: terminalInfo.idProfile,
          mail: userLogin,
          oft: terminalInfo.phoneNumber ? terminalInfo.phoneNumber.slice(-2) : '',
          tel: terminalInfo.phoneNumber,
          userName: terminalInfo.merchantName,
          direccion: `${terminalInfo.street || ''} ${terminalInfo.number || ''}`,
          cp: terminalInfo.cp,
          city: terminalInfo.city,
          spei: terminalInfo.spei,
          commerceType: terminalInfo.commerceType,
          country: terminalInfo.country,
          validate: terminalInfo.guid,
          entitySonID: terminalInfo.entitySonID,
          issueId: terminalInfo.issueId,
          acquiringId: terminalInfo.acquiringId,
          reserveId: reserveId,
          cuenta: balanceResult.virtualAccount || balanceResult.onsignaEntity?.virtualAccount || '',
          inSession: true,
          success: true,
          message: 'existe',
          idBusinessModel: terminalInfo.idBusinessModel,
          idTypeAffiliation: terminalInfo.idTypeAffiliation,
          idStatus: terminalInfo.statusID,
          token: accessToken,
          latitud: latitud,
          longitud: longitud,
          commerceDetailID: terminalInfo.commerceDetailID,
          nodeID: terminalInfo.nodeID
        };

        this.saveSession(sessionData);

        return {
          success: true,
          os: terminalInfo.statusID,
          oft: terminalInfo.phoneNumber ? terminalInfo.phoneNumber.slice(-2) : '',
          userData: sessionData
        };
      }),
      catchError(error => {
        return throwError(() => ({
          success: false,
          idUser: 'B-EAU',
          message: 'No se encontraron resultados.',
          inSession: false
        }));
      })
    );
  }

  // ============================================
  // MÉTODOS PÚBLICOS
  // ============================================

  // Cerrar sesión
  logout(): Observable<any> {
    this.clearSession();
    this.isProcessing = false;
    return new Observable(subscriber => {
      subscriber.next({ success: true, message: 'Sesión cerrada correctamente' });
      subscriber.complete();
    });
  }

  // Obtener saldo
  getSaldo(): Observable<any> {
    const session = this.getSession();
    
    if (!session || !session.token) {
      return throwError(() => new Error('No hay sesión activa'));
    }

    let entS: string;
    if (session.idBusinessModel === 1) {
      entS = session.issueId;
    } else if (session.idBusinessModel === 2 || session.idBusinessModel === 3) {
      entS = session.acquiringId;
    } else {
      entS = session.issueId || session.acquiringId;
    }

    const sonEntity = session.idRol === 2 ? 'com.onsigna' : entS;

    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Entity-i': 'com.onsigna',
      'SonEntity-i': sonEntity,
      'versionApp': '3'
    };

    const url = `${environment.api.entities}getBalance`;
    return this.http.get(url, { headers: this.getHeaders(headers) });
  }

  // Recuperar contraseña
  forgotPassword(email: string): Observable<any> {
    const session = this.getSession();
    
    if (!session || !session.token) {
      return throwError(() => new Error('No hay sesión activa'));
    }

    const url = `${environment.api.kashpay}/api/v1/user/forgotPassword?email=${encodeURIComponent(email)}`;
    
    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Cookie': 'JSESSIONID=ccc03bb85d66a6037878f6eb8ad9'
    };

    return this.http.post(url, {}, { headers: this.getHeaders(headers) });
  }

  // Actualizar contraseña
  updatePassword(passnew: string): Observable<any> {
    const session = this.getSession();
    
    if (!session || !session.token || !session.validate) {
      return throwError(() => new Error('No hay sesión activa'));
    }

    const url = `${environment.api.kashpay}/api/v1/px83/vr12/meridian.k42`;
    
    const body = {
      guid: session.validate,
      tuPassword: passnew
    };

    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    };

    return this.http.put(url, body, { headers: this.getHeaders(headers) });
  }

  // Validar token SMS
  validateSmsToken(tokenSms: string): Observable<any> {
    const session = this.getSession();
    
    if (!session || !session.token || !session.validate) {
      return throwError(() => new Error('No hay sesión activa'));
    }

    const url = `${environment.api.kashpay}/api/v1/c8m4-r7k-/v2/f3a917`;
    
    const body = {
      userGuid: session.validate,
      idOperationType: 20000,
      token: tokenSms
    };

    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    };

    return this.http.post(url, body, { headers: this.getHeaders(headers) });
  }

  // Validar token de sesión
  validateToken(): any {
    const session = this.getSession();
    
    if (!session || !session.token || !session.validate) {
      return {
        success: false,
        message: 'No hay token de sesión',
        needsLogin: true
      };
    }

    return {
      success: true,
      message: 'Token válido'
    };
  }
}