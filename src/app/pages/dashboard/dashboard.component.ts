import { Component, DestroyRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
interface BalanceAmounts { balance: number | null; customerNetworkBalance: number | null; }
import { Subscription } from 'rxjs';
import { DashboardService, DashboardCapabilities, ReportRow } from '../../services/dashboard.service';
type QueryState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

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
  capabilitiesState = signal<QueryState>('loading');
  emisionState = signal<QueryState>('idle');
  reservaState = signal<QueryState>('idle');
  reportState = signal<QueryState>('idle');
  emisionBalance = signal<number | null>(null);
  private readonly capabilities = signal<DashboardCapabilities | null>(null);
  private requests = new Subscription();
  get pendingMessage(): string {
    return this.reportState() === 'loading' ? 'Cargando…' : this.reportState() === 'ready'
      ? 'No hay elementos disponibles.' : 'No fue posible consultar el reporte.';
  }
  readonly reportes = signal<ReportRow[]>([]);
  readonly balanceAhorro = signal<BalanceAmounts[]>([]);
  hoveredAdquirenciaBalance: 'available' | 'pending' = 'available';
  private readonly dashService = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  get userName(): string { return this.auth.getUserData().userName || '-'; }
  cerrarModalImagen(): void { this.mostrarModalImagen = false; }
  ngOnInit(): void { this.cargarDatosIniciales(); }

  get showEmision(): boolean { return this.capabilities()?.emision === true; }
  get showAdquirencia(): boolean { return this.capabilities()?.adquirencia === true; }
  get showReserve(): boolean { return this.capabilities()?.reserva === true; }

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

  get adquirenciaDonutBackground(): string {
    const available = this.adquirenciaAvailable;
    const pending = this.adquirenciaPending;
    if (available === null || pending === null) return '#d9dde7';
    const total = Math.abs(available) + Math.abs(pending);
    if (!total || !Number.isFinite(total)) return '#d9dde7';
    const degrees = Math.abs(available) / total * 360;
    return `conic-gradient(#2f3f55 0deg ${degrees}deg, #d9dde7 ${degrees}deg 360deg)`;
  }

  private balanceError(error: { status?: number; error?: { code?: string } }): QueryState {
    return error?.status === 503 && error.error?.code === 'BALANCE_CONTRACT_PENDING' ? 'unavailable' : 'error';
  }

  cargarDatosIniciales(): void {
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.capabilities.set(null);
    this.capabilitiesState.set('loading');
    this.accountState.set('loading');
    this.emisionState.set('idle');
    this.reservaState.set('idle');
    this.reportState.set('idle');
    this.emisionBalance.set(null);
    this.balanceAhorro.set([]);
    this.reportes.set([]);
    this.virtualAccount.set(null);
    this.adquirencia.set({ balance: null, customerNetworkBalance: null });
    this.requests.add(this.dashService.getCapabilities().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: capabilities => {
        this.capabilities.set(capabilities);
        this.capabilitiesState.set('ready');
        this.loadAccounts(capabilities);
      },
      error: () => { this.capabilitiesState.set('error'); this.accountState.set('error'); }
    }));
  }

  private loadAccounts(capabilities: DashboardCapabilities): void {
    // The concentrator account remains available even when its balance card is hidden.
    this.requests.add(this.dashService.getBalanceSirio().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.virtualAccount.set(response.virtualAccount);
        this.adquirencia.set({ balance: response.balance, customerNetworkBalance: response.customerNetworkBalance });
        this.accountState.set('ready');
      },
      error: () => this.accountState.set('error')
    }));
    if (capabilities.emision) {
      this.emisionState.set('loading');
      this.requests.add(this.dashService.getBalanceAldebaran().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => { this.emisionBalance.set(response.balance); this.emisionState.set('ready'); },
        error: error => { this.emisionBalance.set(null); this.emisionState.set(this.balanceError(error)); }
      }));
    }
    if (capabilities.reserva) {
      this.reservaState.set('loading');
      this.requests.add(this.dashService.getBalanceAhorro().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => { this.balanceAhorro.set([response]); this.reservaState.set('ready'); },
        error: error => { this.balanceAhorro.set([]); this.reservaState.set(this.balanceError(error)); }
      }));
    }
    if (capabilities.adquirencia) {
      this.reportState.set('loading');
      this.requests.add(this.dashService.getReport().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => { this.reportes.set(response.rows); this.reportState.set('ready'); },
        error: () => { this.reportes.set([]); this.reportState.set('error'); }
      }));
    }
  }
}
