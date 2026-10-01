import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

@Injectable({ providedIn: 'root' })
export class SeguimientoProspectoService {
  private readonly http = inject(HttpClient);

  completar(url: string): Observable<void> {
    return this.http.put<{ success?: boolean; message?: string } | null>(
      `${environment.api.KashpayCoreAPI}prospect/follow_up_link`,
      { url, statusDescription: 'COMPLETED' },
      { context: new HttpContext().set(SKIP_AUTH_TOKEN, true) }
    ).pipe(map(respuesta => {
      if (respuesta?.success === false) {
        throw new Error(respuesta.message || 'No fue posible completar el seguimiento del prospecto.');
      }
    }));
  }
}
