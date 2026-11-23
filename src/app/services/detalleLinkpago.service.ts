import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DetalleLinkPagoService {
  private readonly http = inject(HttpClient);
  private readonly bff = '/api/detalle-link-pago';

  obtenerDetalle(referencia: string): Observable<any> {
    return this.http.get<any>(
      `${this.bff}/order/${encodeURIComponent(referencia)}`,
      { withCredentials: true }
    );
  }
}
