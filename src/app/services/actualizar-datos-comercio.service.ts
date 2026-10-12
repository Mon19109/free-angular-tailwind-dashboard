import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export type DispersionAccount = 'OTHER_BANK' | 'NETWORK' | 'OTHER_BANK_AND_NETWORK';

@Injectable({ providedIn: 'root' })
export class ActualizarDatosComercioService {
  private readonly http = inject(HttpClient);

  actualizarDispersion(commerceGuid: string, dispersionAccount: DispersionAccount, bearerToken?: string): Observable<void> {
    return this.http.put<{ success?: boolean; message?: string } | null>(
      `${environment.api.KashpayCoreAPI}merchant/updateData`,
      { commerceGuid, dispersionAccount },
      { headers: new HttpHeaders({ Authorization: `Bearer ${bearerToken ?? environment.bearerTokens.actualizarDatosComercio}`, versionApp: '3' }) }
    ).pipe(map(respuesta => {
      if (respuesta?.success === false) {
        throw new Error(respuesta.message || 'No fue posible actualizar la cuenta de dispersión.');
      }
    }));
  }
}
