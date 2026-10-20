import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';

export interface AccountBalanceResponse {
  success: true;
  virtualAccount: string | null;
}

export class DashboardContractPendingError extends Error {
  constructor() { super('Consulta pendiente de integración con el BFF'); }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getBalanceSirio(): Observable<AccountBalanceResponse> {
    return this.http.get<AccountBalanceResponse>('/api/account/balance', {
      withCredentials: true
    }).pipe(map(response => {
      if (response?.success !== true ||
          (response.virtualAccount !== null && typeof response.virtualAccount !== 'string')) {
        throw new Error('Respuesta de cuenta no válida');
      }
      // Este contrato entrega una cuenta, no importes de saldo.
      return { success: true as const, virtualAccount: response.virtualAccount };
    }));
  }

  // No ejecutar APIs antiguas ni sustituir estas cuentas por la cuenta Sirio.
  // Los contratos faltantes se detallan en docs/dashboard-integracion.txt.
  getBalanceAhorro(): Observable<never> {
    return throwError(() => new DashboardContractPendingError());
  }
  getBalanceAldebaran(): Observable<never> {
    return throwError(() => new DashboardContractPendingError());
  }
  getReport(): Observable<never> {
    return throwError(() => new DashboardContractPendingError());
  }
}
