import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface EnviarInvitacionComercioRequest {
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class EnviarInvitacionComercioService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/invitaciones/comercio';

  enviarInvitacion(payload: EnviarInvitacionComercioRequest): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(this.url, { email: payload.email, name: payload.name }, {
      withCredentials: true,
      headers: { 'X-Portal-Request': '1' }
    });
  }
}
