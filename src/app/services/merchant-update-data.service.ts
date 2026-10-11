import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../environments/environments';

export interface MerchantUpdateDataPayload extends Record<string, unknown> {
  commerceGuid: string;
}

@Injectable({ providedIn: 'root' })
export class MerchantUpdateDataService {
  private readonly http = inject(HttpClient);

  actualizar(payload: MerchantUpdateDataPayload): Observable<void> {
    let token = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
    try {
      token = JSON.parse(localStorage.getItem('auth_session') || '{}')?.token || token;
    } catch { /* Usa el token de sesión legacy. */ }
    if (!token) return throwError(() => new Error('La sesión no tiene un token válido. Inicia sesión nuevamente.'));
    if (!payload.commerceGuid.trim()) return throwError(() => new Error('No se encontró el identificador del comercio.'));
    return this.http.put<{ success?: boolean; message?: string } | null>(
      `${environment.api.KashpayCoreAPI}merchant/updateData`, payload,
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}`, versionApp: '3', 'Content-Type': 'application/json' }) }
    ).pipe(map(respuesta => {
      if (respuesta?.success === false) throw new Error(respuesta.message || 'No fue posible actualizar los datos del comercio.');
    }));
  }
}
