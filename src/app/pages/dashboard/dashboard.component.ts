import { Component, DestroyRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
interface BalanceAmounts { balance: number | null; customerNetworkBalance: number | null; }
interface ReportRow {
  brandName: string; numTrs: number | null; totalCost: number | null;
  totalFee: number | null; totalFeeTax: number | null;
  totalAmount: number | null; totalNetAmount: number | null;
}
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './dashboard.component.html',  
  styleUrls: ['./dashboard.component.css']   
})
export class DashboardComponent {
  mostrarModalImagen = true;
  virtualAccount = signal<string | null>(null);
  private readonly adquirencia = signal<BalanceAmounts>({
    balance: null, customerNetworkBalance: null
  });
  accountState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly pendingMessage = 'Consulta pendiente de integración con el BFF.';
  readonly reportes = signal<ReportRow[]>([]);
  readonly balanceAhorro = signal<BalanceAmounts[]>([]);
  hoveredAdquirenciaBalance: 'available' | 'pending' = 'available';
  private readonly dashService = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  get userName(): string { return this.auth.getUserData().userName || '-'; }
  cerrarModalImagen(): void { this.mostrarModalImagen = false; }
  ngOnInit(): void { this.cargarDatosIniciales(); }

  // /me no entrega capacidades de cuenta. Mantener visibles las secciones
  // como no disponibles, sin inferir permisos ni leer identificadores locales.
  readonly showEmision = true;
  readonly showAdquirencia = true;
  readonly showReserve = true;

  money(value: unknown): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'No disponible';
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  setHoveredAdquirenciaBalance(type: 'available' | 'pending'): void {
    this.hoveredAdquirenciaBalance = type;
  }

  get adquirenciaAvailable(): number | null { return this.adquirencia().balance; }
  get adquirenciaPending(): number | null { return this.adquirencia().customerNetworkBalance; }

  get hoveredAdquirenciaLabel(): string {
    return this.hoveredAdquirenciaBalance === 'available' ? 'Disponible' : 'Pendiente';
  }

  get hoveredAdquirenciaAmount(): number | null {
    return this.hoveredAdquirenciaBalance === 'available'
      ? this.adquirenciaAvailable
      : this.adquirenciaPending;
  }

  get adquirenciaDonutBackground(): string { return '#d9dde7'; }

  cargarDatosIniciales(): void {
    this.accountState.set('loading');
    this.virtualAccount.set(null);
    this.adquirencia.set({ balance: null, customerNetworkBalance: null });
    this.dashService.getBalanceSirio().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.virtualAccount.set(response.virtualAccount);
        this.adquirencia.set({
          balance: response.balance,
          customerNetworkBalance: response.customerNetworkBalance
        });
        this.accountState.set('ready');
      },
      error: () => this.accountState.set('error')
    });
  }
}
