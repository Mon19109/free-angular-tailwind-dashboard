import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../environments/environments';

export interface MerchantUpdateDataPayload extends Record<string, unknown> {
  commerceGuid: string;
}

@Injectable({ providedIn: 'root' })
export class MerchantUpdateDataService {
  private readonly sessionAuth = inject(AuthService);
  private readonly http = inject(HttpClient);

  actualizar(payload: MerchantUpdateDataPayload): Observable<void> {
    const token = this.sessionAuth.getToken() || '';
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
