// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environments';

export interface DeviceInfo {
  os: string;
  latitude: string;
  longitude: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  latitud: string;
  longitud: string;
}

export interface TerminalInfo {
  userID: number;
  contextID: number;
  entityID: number;
  terminalID: number;
  terminalUserID: number;
  affiliationLevelID: number;
  idProfile: number;
  phoneNumber: string;
  merchantName: string;
  street: string;
  number: string;
  cp: string;
  city: string;
  spei: string;
  commerceType: string;
  country: string;
  guid: string;
  entitySonID: string;
  issueId: string;
  acquiringId: string;
  reserveId?: string;
  idBusinessModel: number;
  idTypeAffiliation: number;
  statusID: number;
}

export interface LoginAPIResponse {
  success: boolean;
  terminalInfo: TerminalInfo;
  error?: {
    message: string;
  };
}

export interface BalanceResponse {
  virtualAccount: string;
  [key: string]: any;
}

export interface AuthTokenResponse {
  authenticationResponse: {
    token: string;
  };
}

export interface UserSessionData {
  idUser: number;
  idContext: number;
  idEntity: number;
  idTerminal: number;
  idTerminalUser: number;
  idRol: number;
  idPerfil: number;
  mail: string;
  tel: string;
  userName: string;
  direccion: string;
  cp: string;
  city: string;
  spei: string;
  commerceType: string;
  country: string;
  validate: string;
  entitySonID: string;
  issueId: string;
  acquiringId: string;
  reserveId: string;
  cuenta: string;
  inSession: string;
  success: boolean;
  message: string;
  idBusinessModel: number;
  idTypeAffiliation: number;
  idStatus: number;
  token: string;
  latitud: string;
  longitud: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  /*private wsKashPayServices = 'http://sdbx-antares.kashplataforma.com/';
  private wsSaldos = 'http://10.15.5.171/'; // Ajusta según tu configuración
  private wsAuthenticate = 'http://sdbx-polaris.kashplataforma.com/AuthenticationService/'; // Ajusta según tu configuración
  */
  private wsKashPayServices = environment.api.kashpay;
  private wsSaldos = environment.api.saldos;
  private wsAuthenticate = environment.api.auth
  
  private authEntity = 'com.onsigna'; // Configurar desde environment
  private tokenKey = 'auth_token';
  private userKey = 'user_data';

  


  private getCommonHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<UserSessionData> {
    const deviceInfo: DeviceInfo = {
      os: 'WEB',
      latitude: credentials.latitud,
      longitude: credentials.longitud
    };

    const loginData = {
      email: credentials.email,
      password: credentials.password,
      device: deviceInfo
    };

    /*const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0')
      .set('Content-Type', 'application/json')*/

    const headers = this.getCommonHeaders();
      
        console.log('Intentando login a:', this.wsKashPayServices);
    console.log('Headers:', headers.keys());
    console.log('Datos:', loginData);
    console.log('Intentando auth a:', this.wsAuthenticate);

    /*auth.service.ts
  return this.http.post<LoginAPIResponse>({
    '/api/v1/user/login',  // Limpio y claro
    loginData,
    headers: headers,
    withCredentials: true
  }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta login:', response)),
      switchMap(response => this.processLoginResponse(response, credentials)),
      catchError(this.handleError)
  );
*/

  return this.http.post<LoginAPIResponse>(`${this.wsKashPayServices}user/login`, loginData, { 
      headers: headers,
      withCredentials: true
    }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta login:', response)),
      switchMap(response => this.processLoginResponse(response, credentials)),
      catchError(this.handleError)
    );

  }

  private processLoginResponse(response: LoginAPIResponse, credentials: LoginCredentials): Observable<UserSessionData> {
    if (response.success && response.terminalInfo) {
      const terminalInfo = response.terminalInfo;
      
      // Determinar entS basado en idBusinessModel
      let entS: string;
      if (terminalInfo.idBusinessModel === 1) {
        entS = terminalInfo.issueId;
      } else if (terminalInfo.idBusinessModel === 2 || terminalInfo.idBusinessModel === 3) {
        entS = terminalInfo.acquiringId;
      } else {
        entS = '';
      }

      // Obtener balance
      return this.getBalance(entS).pipe(
        switchMap(balanceData => {
          // Obtener token de autenticación
          return this.getAuthToken(credentials.password, terminalInfo.entitySonID).pipe(
            map(authToken => {
              // Procesar virtualAccount según affiliationLevelID
              let virtualAccount = balanceData?.virtualAccount || '';
              if (terminalInfo.affiliationLevelID === 2) {
                virtualAccount = '';
              }

              const reserveId = terminalInfo.reserveId || '';
              const direccion = `${terminalInfo.street || ''} ${terminalInfo.number || ''}`.trim();

              // Construir objeto de sesión
              const sessionData: UserSessionData = {
                idUser: terminalInfo.userID,
                idContext: terminalInfo.contextID,
                idEntity: terminalInfo.entityID,
                idTerminal: terminalInfo.terminalID,
                idTerminalUser: terminalInfo.terminalUserID,
                idRol: terminalInfo.affiliationLevelID,
                idPerfil: terminalInfo.idProfile,
                mail: credentials.email,
                tel: terminalInfo.phoneNumber || '',
                userName: terminalInfo.merchantName || '',
                direccion: direccion,
                cp: terminalInfo.cp || '',
                city: terminalInfo.city || '',
                spei: terminalInfo.spei || '',
                commerceType: terminalInfo.commerceType || '',
                country: terminalInfo.country || '',
                validate: terminalInfo.guid || '',
                entitySonID: terminalInfo.entitySonID || '',
                issueId: terminalInfo.issueId || '',
                acquiringId: terminalInfo.acquiringId || '',
                reserveId: reserveId,
                cuenta: virtualAccount,
                inSession: 'true',
                success: true,
                message: 'existe',
                idBusinessModel: terminalInfo.idBusinessModel,
                idTypeAffiliation: terminalInfo.idTypeAffiliation,
                idStatus: terminalInfo.statusID,
                token: authToken,
                latitud: credentials.latitud,
                longitud: credentials.longitud
              };

              // Guardar en localStorage
              this.setSession(sessionData);
              return sessionData;
            })
          );
        })
      );
    } else {
      // Error en login
      const errorSession: UserSessionData = {
        idUser: 0,
        idContext: 0,
        idEntity: 0,
        idTerminal: 0,
        idTerminalUser: 0,
        idRol: 0,
        idPerfil: 0,
        mail: '',
        tel: '',
        userName: '',
        direccion: '',
        cp: '',
        city: '',
        spei: '',
        commerceType: '',
        country: '',
        validate: '',
        entitySonID: '',
        issueId: '',
        acquiringId: '',
        reserveId: '',
        cuenta: '',
        inSession: 'false',
        success: false,
        message: response.error?.message || 'Error en el login',
        idBusinessModel: 0,
        idTypeAffiliation: 0,
        idStatus: 0,
        token: '',
        latitud: '',
        longitud: ''
      };
      return of(errorSession);
    }
  }

  private getBalance(entS: string): Observable<BalanceResponse> {
    if (!entS) {
      return of({ virtualAccount: '' });
    }

    const headers = new HttpHeaders()
      .set('Authorization', 'Basic YWRtaW46c2VjcmV0');

    return this.http.get<BalanceResponse>(
      `${this.wsSaldos}getBalance/${entS}`,
      { headers }
    ).pipe(
      catchError(() => of({ virtualAccount: '' }))
    );
  }

  private getCommonHeadersToken(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Basic YWRtaW46c2VjcmV0'
    });
  }


  private getAuthToken(password: string, entitySonID: string): Observable<string> {
    const authData = {
      entity: this.authEntity,
      password: password,
      user: entitySonID
    };

  

    //const headers = new HttpHeaders();

    
    const headersAut = this.getCommonHeaders();

    /*return this.http.post<AuthTokenResponse>(`${this.wsAuthenticate}/authenticate`, authData, { 
      headers: headersAut,
      withCredentials: true
    }).pipe(
      //timeout(30000),
      tap(response => console.log('Respuesta auth:', response)),
      switchMap(response => this.processLoginResponse(response, credentials)),
      catchError(this.handleError)
    );*/



    return this.http.post<AuthTokenResponse>(
      `${this.wsAuthenticate}authenticate`,
      authData,{
      headers: headersAut,
      withCredentials: true
    }).pipe(
      map(response => response.authenticationResponse?.token || ''),
      catchError(() => of(''))
    );
  }

  private setSession(sessionData: UserSessionData): void {
    if (sessionData.token) {
      localStorage.setItem(this.tokenKey, sessionData.token);
      //localStorage.setItem(sessionData);
      localStorage.setItem('idUser', sessionData.idUser.toString());
      localStorage.setItem('idContext', sessionData.idContext.toString());
      localStorage.setItem('idEntity', sessionData.idEntity.toString());
      localStorage.setItem('idTerminal', sessionData.idTerminal.toString());
      localStorage.setItem('idTerminalUser', sessionData.idTerminalUser.toString());
      localStorage.setItem('idRol', sessionData.idRol.toString());
      localStorage.setItem('idPerfil', sessionData.idPerfil.toString());
      localStorage.setItem('mail', sessionData.mail);
      localStorage.setItem('tel', sessionData.tel);
      localStorage.setItem('userName', sessionData.userName);
      localStorage.setItem('direccion', sessionData.direccion);
      localStorage.setItem('cp', sessionData.cp);
      localStorage.setItem('city', sessionData.city);
      localStorage.setItem('spei', sessionData.spei);
      localStorage.setItem('commerceType', sessionData.commerceType);
      localStorage.setItem('country', sessionData.country);
      localStorage.setItem('validate', sessionData.validate);
      localStorage.setItem('entitySonID', sessionData.entitySonID);
      localStorage.setItem('issueId', sessionData.issueId);
      localStorage.setItem('acquiringId', sessionData.acquiringId);
      localStorage.setItem('reserveId', sessionData.reserveId);
      localStorage.setItem('cuenta', sessionData.cuenta);
      localStorage.setItem('inSession', sessionData.inSession);
      localStorage.setItem('success', sessionData.success.toString());
      localStorage.setItem('message', sessionData.message);
      localStorage.setItem('idBusinessModel', sessionData.idBusinessModel.toString());
      localStorage.setItem('idTypeAffiliation', sessionData.idTypeAffiliation.toString());
      localStorage.setItem('idStatus', sessionData.idStatus.toString());
      localStorage.setItem('token', sessionData.token);
      localStorage.setItem('latitud', sessionData.latitud);
      localStorage.setItem('longitud', sessionData.longitud);
    }
    localStorage.setItem(this.userKey, JSON.stringify(sessionData));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    
    if (!token || !user) return false;
    
    // Verificar expiración del token si es JWT
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirado = payload.exp * 1000 < Date.now();
      if (expirado) {
        this.logout();
      }
      return !expirado && user.inSession === 'true';
    } catch {
      return !!token && user.inSession === 'true';
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): UserSessionData | null {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  getUserRol(): number {
    // Obtener de localStorage/sessionStorage
    return parseInt(localStorage.getItem('idRol') || '0');
  }

  getUserContext(): number {
    return parseInt(localStorage.getItem('idContext') || '0');
  }

  getUserEmail(): string {
    return localStorage.getItem('mail') || '';
  }

  updateUserCoordinates(latitud: string, longitud: string): void {
    const user = this.getUser();
    if (user) {
      user.latitud = latitud;
      user.longitud = longitud;
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
  }

  getCurrentLocation(): Promise<{ latitud: string; longitud: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitud: position.coords.latitude.toString(),
            longitud: position.coords.longitude.toString()
          };
          this.updateUserCoordinates(coords.latitud, coords.longitud);
          resolve(coords);
        },
        (error) => {
          let errorMessage = 'Error al obtener ubicación';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permiso denegado';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Ubicación no disponible';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tiempo de espera agotado';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en AuthService:', error);
    let errorMessage = 'Error en la comunicación con el servidor';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 401) {
      errorMessage = 'Credenciales incorrectas';
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar con el servidor';
    }else if (error.status === 409) {
      errorMessage = 'No se pudo conectar con el servidor';
    }
    
    return throwError(() => new Error(errorMessage));
  }
}