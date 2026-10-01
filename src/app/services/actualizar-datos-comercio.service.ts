import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export type DispersionAccount = 'OTHER_BANK' | 'NETWORK' | 'OTHER_BANK_AND_NETWORK';

@Injectable({ providedIn: 'root' })
export class ActualizarDatosComercioService {
  private readonly http = inject(HttpClient);
  private readonly bearerToken = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI5ZjhhMjZlZS0xZWFkLTRmN2QtODlhMi0zZGFiZjU2YTNjZGQiLCJzZXNzaW9uSWQiOiI4NTlhN2NmYS1hNDA2LTRmYjItOTY3Yi02MzlmZDBjNmUyMzMiLCJlbWFpbCI6InN1YmFmaWxrbUBrbS5jb20iLCJkZXZpY2VJZCI6IjdlNDMyMDg0MmNmMGNlNzg0MjYyZDgzNzRkZmVlM2QzN2VhYTc3ZThlMjMyNmFmNzY3YWQ2YWRiMjU2NGZhNjciLCJ0eXBlIjoiYWNjZXNzIiwic2NvcGVzIjpbInJlYWQiLCJ3cml0ZSJdLCJpYXQiOjE3ODE5MTUwMTMsImV4cCI6MTc4MTkxODYxM30.YprLcc_8SeAV7V8CCBvIEnBLigHT6U9QtMc4bpJ2YYJrC0K0kVKCt1pebSgVAcc-c1hpPW1K11eve5uzlIoVTA';

  actualizarDispersion(commerceGuid: string, dispersionAccount: DispersionAccount): Observable<void> {
    return this.http.put<{ success?: boolean; message?: string } | null>(
      `${environment.api.KashpayCoreAPI}merchant/updateData`,
      { commerceGuid, dispersionAccount },
      { headers: new HttpHeaders({ Authorization: `Bearer ${this.bearerToken}`, versionApp: '3' }) }
    ).pipe(map(respuesta => {
      if (respuesta?.success === false) {
        throw new Error(respuesta.message || 'No fue posible actualizar la cuenta de dispersión.');
      }
    }));
  }
}
