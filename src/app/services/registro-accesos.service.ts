import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface RegistroAccesoPayload {
  sirioId: string;
  idAffiliationLevel: number;
  idProfile: 5 | 7 | 9 | 17;
  name: string;
  paternalSurname: string;
  maternalSurname: string;
  email: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroAccesosService {
  private readonly http = inject(HttpClient);

  agregarUsuario(payload: RegistroAccesoPayload): Observable<unknown> {

    return this.http.post<{ success?: boolean; message?: string }>(
      `${environment.api.antaresAuth}user/add`,
      payload,
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          versionApp: '3'
        })
      }
    ).pipe(
      map(response => {
        if (response?.success === false) {
          throw new Error(
            response.message || 'No fue posible crear el acceso.'
          );
        }

        return response;
      })
    );
  }
}
