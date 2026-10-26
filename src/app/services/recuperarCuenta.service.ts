import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RecuperarCuentaRequest {
  guid: string;
  nueva: string;
}

@Injectable({ providedIn: 'root' })
export class RecuperarCuentaService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/recuperar-cuenta/confirmar';

  recuperarCuenta(data: RecuperarCuentaRequest): Observable<any> {
    // Se conserva el contrato que consumen los componentes Angular.
    // La credencial del proveedor se utiliza exclusivamente en el BFF.
    return this.http.put(this.endpoint, data, { withCredentials: true });
  }
}
