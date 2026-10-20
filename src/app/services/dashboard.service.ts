import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface AccountBalanceResponse {
  success: true;
  virtualAccount: string | null;
  balance: number | null;
  customerNetworkBalance: number | null;
}
export interface DashboardCapabilities { success: true; emision: boolean; adquirencia: boolean; reserva: boolean; }
export interface DashboardAmounts { success: true; balance: number | null; customerNetworkBalance: number | null; }
export interface ReportRow {
  brandName: string; numTrs: number | null; totalCost: number | null;
  totalFee: number | null; totalFeeTax: number | null;
  totalAmount: number | null; totalNetAmount: number | null;
}
export interface DashboardReport { success: true; rows: ReportRow[]; }

function amount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Respuesta de saldo no válida');
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta no válida');
  return value as Record<string, unknown>;
}
function successful(value: unknown): Record<string, unknown> {
  const data = record(value);
  if (data['success'] !== true) throw new Error('Respuesta no válida');
  return data;
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
      return {
        success: true as const,
        virtualAccount: response.virtualAccount,
        balance: amount(response.balance),
        customerNetworkBalance: amount(response.customerNetworkBalance)
      };
    }));
  }

  getCapabilities(): Observable<DashboardCapabilities> {
    return this.http.get<unknown>('/api/account/capabilities', { withCredentials: true }).pipe(map(response => {
      const data = successful(response);
      if (['emision', 'adquirencia', 'reserva'].some(key => typeof data[key] !== 'boolean')) throw new Error('Capacidades no válidas');
      return { success: true, emision: data['emision'] as boolean, adquirencia: data['adquirencia'] as boolean, reserva: data['reserva'] as boolean };
    }));
  }

  private getAmounts(path: string): Observable<DashboardAmounts> {
    return this.http.get<unknown>(path, { withCredentials: true }).pipe(map(response => {
      const data = successful(response);
      return { success: true, balance: amount(data['balance']), customerNetworkBalance: amount(data['customerNetworkBalance']) };
    }));
  }
  getBalanceAhorro(): Observable<DashboardAmounts> { return this.getAmounts('/api/account/reserva'); }
  getBalanceAldebaran(): Observable<DashboardAmounts> { return this.getAmounts('/api/account/emision'); }

  getReport(): Observable<DashboardReport> {
    return this.http.get<unknown>('/api/account/report', { withCredentials: true }).pipe(map(response => {
      const data = successful(response);
      if (!Array.isArray(data['rows'])) throw new Error('Reporte no válido');
      const rows = data['rows'].map(value => {
        const row = record(value);
        if (typeof row['brandName'] !== 'string' || !row['brandName'].trim()) throw new Error('Reporte no válido');
        const count = amount(row['numTrs']);
        if (count !== null && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Reporte no válido');
        return { brandName: row['brandName'], numTrs: count, totalCost: amount(row['totalCost']),
          totalFee: amount(row['totalFee']), totalFeeTax: amount(row['totalFeeTax']),
          totalAmount: amount(row['totalAmount']), totalNetAmount: amount(row['totalNetAmount']) };
      });
      return { success: true, rows };
    }));
  }
}
