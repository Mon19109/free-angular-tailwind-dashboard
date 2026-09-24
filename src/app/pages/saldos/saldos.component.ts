import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaldosService } from '../../services/saldos.service';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { SelectComponent } from '../../shared/components/form/select/select.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize, Observable, Subscription } from 'rxjs';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-saldos',
  standalone: true,
  imports: [CommonModule, SelectComponent, ProcessingOverlayComponent],
  templateUrl: './saldos.component.html',
  styleUrls: ['./saldos.component.scss']
})

export class SaldosComponent implements OnInit {

  private saldosService = inject(SaldosService);
  private operacionesEmisionService = inject(OperacionesEmisionService);

  entidades: any[] = [];
  saldos: any[] = [];
  cuentaSeleccionada = '';
  entidadSeleccionada = '';
  cuentas: any[] = [];
  fatherIDActual = '';

  get cuentasOptions() {
    return this.cuentas.map(cuenta => ({
      label: cuenta.name,
      value: String(cuenta.idSirio)
    }));
  }

  get entidadesOptions() {
    return this.entidades.map(entidad => ({
      label: `${entidad.bundle} - ${entidad.bussinesName}`,
      value: String(entidad.bundle)
    }));
  }

  seleccionarCuenta(cuenta: string): void {
    this.onCuentaChange({ target: { value: cuenta } } as unknown as Event);
  }

  seleccionarEntidad(entidad: string): void {
    this.onEntidadChange({ target: { value: entidad } } as unknown as Event);
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly cargando = signal(false);
  errorCarga = '';
  private consultasPendientes = 0;
  private entidadesRequest?: Subscription;
  private saldoRequest?: Subscription;

  private conCarga<T>(request: Observable<T>): Observable<T> {
    return defer(() => {
      this.consultasPendientes += 1;
      this.cargando.set(true);
      return request.pipe(finalize(() => {
        this.consultasPendientes -= 1;
        this.cargando.set(this.consultasPendientes > 0);
        this.changeDetector.markForCheck();
      }));
    }).pipe(takeUntilDestroyed(this.destroyRef));
  }

  ngOnInit(): void {
    this.conCarga(this.operacionesEmisionService.obtenerConcentratorAccounts()).subscribe({
      next: resp => {
        this.cuentas = resp;
        const cuentaAdquirente = this.cuentas.find(cuenta => Number(cuenta.idbusinessModel) === 2);
        if (cuentaAdquirente?.idSirio) {
          this.seleccionarCuenta(String(cuentaAdquirente.idSirio));
        }
      },
      error: () => { this.errorCarga = 'No se pudieron cargar las cuentas. Intenta de nuevo.'; }
    });
  }

  onCuentaChange(event: Event): void {
    const cuenta = (event.target as HTMLSelectElement).value;
    this.entidadesRequest?.unsubscribe();
    this.saldoRequest?.unsubscribe();
    this.cuentaSeleccionada = cuenta;
    this.entidadSeleccionada = '';
    this.entidades = [];
    this.saldos = [];
    this.fatherIDActual = '';
    this.errorCarga = '';

    const cuentaSeleccionada = this.cuentas.find(c => String(c.idSirio) === cuenta);
    if (!cuentaSeleccionada) return;

    if (Number(cuentaSeleccionada.idbusinessModel) === 2) {
      this.cargarSaldo(cuenta);
      return;
    }

    this.entidadesRequest = this.conCarga(
      this.operacionesEmisionService.obtenerEntidades(cuenta)
    ).subscribe({
      next: resp => { this.entidades = resp; },
      error: () => { this.errorCarga = 'No se pudieron cargar las entidades. Vuelve a seleccionar la cuenta.'; }
    });
  }

  onEntidadChange(event: Event): void {
    const entidad = (event.target as HTMLSelectElement).value;
    this.entidadSeleccionada = entidad;
    this.cargarSaldo(entidad);
  }

  cargarSaldo(fatherId?: string): void {
    this.saldoRequest?.unsubscribe();
    this.saldos = [];
    this.errorCarga = '';
    this.fatherIDActual = fatherId ?? '';
    if (!fatherId) return;

    this.saldoRequest = this.conCarga(this.saldosService.getDetalleSaldo(fatherId)).subscribe({
      next: (response: any) => {
        this.saldos = (response.entities ?? []).map((item: any) => ({
          id: item.id,
          nombre: item.name,
          email: item.email,
          telefono: item.phoneNumber,
          saldoPrincipal: this.formatCurrency(item.balance),
          saldoGarantia: this.formatCurrency(item.warrantyBalance),
          saldoPendiente: this.formatCurrency(item.customerNetworkBalance),
          saldoTarjeta: this.formatCurrency(item.cardAvailableBalance)
        }));
      },
      error: () => { this.errorCarga = 'No se pudieron cargar los saldos. Intenta de nuevo.'; }
    });
  }

  exportarPDF(): void {
    if (!this.saldos.length) return;

    const fecha = this.obtenerFechaArchivo();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(18);
    doc.text(`Detalle de saldos - ${fecha}`, 148, 20, { align: 'center' });

    autoTable(doc, {
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [199, 146, 75], textColor: [20, 20, 20], fontStyle: 'bold' },
      head: [this.encabezadosExportacion()],
      body: this.filasExportacion()
    });

    doc.save(`DetalleSaldos-${fecha}.pdf`);

}

exportarExcel(): void {
  if (!this.saldos.length) return;

  const fecha = this.obtenerFechaArchivo();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [`DetalleSaldos-${fecha}`],
    this.encabezadosExportacion(),
    ...this.filasExportacion()
  ]);
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  worksheet['!cols'] = this.encabezadosExportacion().map(() => ({ wch: 22 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DetalleSaldos');
  XLSX.writeFile(workbook, `DetalleSaldos-${fecha}.xlsx`);

}

private encabezadosExportacion(): string[] {
  return ['ID', 'Nombre', 'Email', 'Telefono', 'Saldo Principal', 'Saldo Garantia', 'Saldo Pendiente', 'Saldo Tarjeta'];
}

private filasExportacion(): string[][] {
  return this.saldos.map(item => [
    item.id,
    item.nombre,
    item.email,
    item.telefono,
    item.saldoPrincipal,
    item.saldoGarantia,
    item.saldoPendiente,
    item.saldoTarjeta
  ]);
}

private formatCurrency(value: string | number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(this.toNumber(value));
}

private toNumber(value: string | number): number {
  if (value === null || value === undefined || value === '') return 0;
  return typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, '')) || 0;
}

private obtenerFechaArchivo(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

}
