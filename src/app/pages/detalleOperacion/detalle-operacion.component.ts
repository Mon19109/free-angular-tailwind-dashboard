import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { fechaOperacion } from '../../shared/utils/operaciones-tabla';

@Component({
  selector: 'app-detalle-operacion', standalone: true,
  imports: [CommonModule, RouterLink, ProcessingOverlayComponent],
  templateUrl: './detalle-operacion.component.html',
  styleUrl: './detalle-operacion.component.css'
})
export class DetalleOperacionComponent {
  private readonly service = inject(OperacionesEmisionService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly operaciones = signal<any[]>([]);
  liquidationID = '';
  readonly columnas = [{"titulo": "Monto", "campo": "amount"}, {"titulo": "Núm. de Autorización", "campo": "authorizationNumber"}, {"titulo": "Tarjeta", "campo": "card"}, {"titulo": "Referencia", "campo": "authorizationRrcext"}, {"titulo": "Fecha de Autorización", "campo": "authorizationDate"}, {"titulo": "Estatus", "campo": "status"}, {"titulo": "Institución", "campo": "institution"}, {"titulo": "Marca", "campo": "brand"}, {"titulo": "Naturaleza", "campo": "nature"}, {"titulo": "Entidad", "campo": "entityName"}, {"titulo": "Terminal", "campo": "terminalName"}, {"titulo": "Tipo de Transacción", "campo": "transactiontype"}, {"titulo": "EntryMode", "campo": "entryMode"}, {"titulo": "Monto Adicional", "campo": "feeAmount"}, {"titulo": "ResponseDescription", "campo": "responseDescription"}, {"titulo": "QtPay", "campo": "qtPay"}, {"titulo": "PlanId", "campo": "planId"}, {"titulo": "GraceNumber", "campo": "graceNumber"}, {"titulo": "Concepto", "campo": "concept"}, {"titulo": "Bin", "campo": "bin"}, {"titulo": "Send_Sirio", "campo": "sendSirio"}, {"titulo": "IVA", "campo": "iva"}, {"titulo": "Comisión1", "campo": "com1"}, {"titulo": "Comisión2", "campo": "com2"}, {"titulo": "Comisión3", "campo": "com3"}, {"titulo": "Entity OperationId", "campo": "entityOperationId"}, {"titulo": "Transaction Builder", "campo": "transactionBuilder"}, {"titulo": "Id Liquidacion", "campo": "liquidation_id"}, {"titulo": "Estatus Sirio", "campo": "statusSirio"}];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.liquidationID = params.get('validate')?.trim() || '';
      this.cargar();
    });
  }

  cargar(): void {
    this.request?.unsubscribe();
    this.operaciones.set([]);
    this.error.set('');
    if (!this.liquidationID) { this.error.set('Falta la referencia de liquidación.'); return; }
    this.cargando.set(true);
    this.request = this.service.obtenerDetalleOperacion(this.liquidationID).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.cargando.set(false))
    ).subscribe({
      next: response => {
        if (response?.success === false) { this.error.set('No fue posible consultar el detalle.'); return; }
        const body = response?.rows ?? response;
        const rows = Array.isArray(body) ? body : body?.content ?? body?.operations;
        if (!Array.isArray(rows)) { this.error.set('El servicio no devolvió un listado de operaciones válido.'); return; }
        this.operaciones.set(rows.map(row => this.prepararOperacion(row)));
      },
      error: () => this.error.set('No fue posible consultar el detalle. Intenta de nuevo.')
    });
  }

  private prepararOperacion(row: any): any {
    const acquiring = row.operationSirio?.acquiringOperation ?? {};
    const numero = (campo: string) => Number(acquiring[campo] ?? 0) || 0;
    const a = numero('transactionType'), b = numero('transactionSubType'), c = numero('transactionID');
    const d = numero('timestamp'), e = numero('systemTraceAuditNumber');
    const rol = localStorage.getItem('idRol');
    const comisiones: Record<string, number[]> = {
      '2': [0, 0, 0], '3': [a + b, c, d + e],
      '4': [a + b + c, d, e], '5': [a + b + c + d, e, 0],
      '6': [numero('settleAmount'), 0, 0]
    };
    const [com1, com2, com3] = comisiones[rol || ''] ?? [null, null, null];
    return { ...row, iva: acquiring.systemSource ?? 0, com1, com2, com3 };
  }

  valor(row: any, campo: string): string {
    const value = row[campo];
    if (value === null || value === undefined || value === '') return 'ND';
    if (campo === 'authorizationDate') return fechaOperacion(value);
    if (['amount', 'feeAmount', 'iva', 'com1', 'com2', 'com3'].includes(campo)) {
      const amount = Number(value);
      return Number.isFinite(amount) ? '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value);
    }
    return String(value);
  }

  ticketUrl(row: any): string | null {
    if (row.status !== 'Aprobada' || !row.authorizationRrcext || !row.authorizationNumber) return null;
    return 'http://sdbx-antares.kashplataforma.com:7071/resources/vouchers/'
      + encodeURIComponent(String(row.authorizationRrcext) + String(row.authorizationNumber)) + '.pdf';
  }
}
