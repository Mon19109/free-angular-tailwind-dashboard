import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaldosService } from '../../services/saldos.service';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { SelectComponent } from '../../shared/components/form/select/select.component';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-saldos',
  standalone: true,
  imports: [CommonModule, SelectComponent],
  templateUrl: './saldos.component.html',
  styleUrls: ['./saldos.component.scss']
})

export class SaldosComponent implements OnInit {

  private saldosService = inject(SaldosService);
  private operacionesEmisionService = inject(OperacionesEmisionService);

  entidades: any[] = [];
  saldos: any[] = [];
  entidadSeleccionada = '';
  cuentas: any[] = [];
  fatherIDActual = '';

  get cuentasOptions() {
    return this.cuentas.map(cuenta => ({
      label: cuenta.name,
      value: cuenta.idSirio
    }));
  }

  get entidadesOptions() {
    return this.entidades.map(entidad => ({
      label: `${entidad.bundle} - ${entidad.bussinesName}`,
      value: entidad.bundle
    }));
  }

  seleccionarCuenta(cuenta: string): void {
    this.onCuentaChange({ target: { value: cuenta } } as unknown as Event);
  }

  seleccionarEntidad(entidad: string): void {
    this.onEntidadChange({ target: { value: entidad } } as unknown as Event);
  }

  ngOnInit(): void {

  this.operacionesEmisionService
    .obtenerConcentratorAccounts()
    .subscribe({
      next: (resp) => {

        //console.log('CUENTAS', resp);

        this.cuentas = resp;

      }
    });

  this.operacionesEmisionService
    .obtenerCuentas()
    .subscribe({
      next: (resp) => {

       // console.log('ENTIDADES INICIALES', resp);

        this.entidades = resp;

      }
    });

}

  onCuentaChange(event: Event): void {

  const cuenta =
    (event.target as HTMLSelectElement).value;

  this.saldos = [];

  const cuentaSeleccionada =
    this.cuentas.find(c => c.idSirio === cuenta);

  //console.log('OBJETO CUENTA', cuentaSeleccionada);

  if (!cuentaSeleccionada) {
    return;
  }

  // CUENTA ADQUIRENTE
  if (cuentaSeleccionada.idbusinessModel === 2) {

    this.entidades = [];

    this.cargarSaldo(cuenta);

    return;
  }

  // CUENTA EMISION
  this.operacionesEmisionService
    .obtenerEntidades(cuenta)
    .subscribe({
      next: (resp) => {

        //console.log('ENTIDADES EMISION', resp);

        this.entidades = resp;

      }
    });

}

  onEntidadChange(event: Event): void {

    const fatherID =
      (event.target as HTMLSelectElement).value;

    console.log('Entidad seleccionada:', fatherID);

    this.entidadSeleccionada = fatherID;

    this.cargarSaldo(fatherID);

  }

  cargarSaldo(fatherId?: string): void {

    const fatherIDFinal = fatherId;
    this.fatherIDActual = fatherId ?? '';
    if (!fatherIDFinal) {
      return;
    }

    this.saldosService
      .getDetalleSaldo(fatherIDFinal)
      .subscribe({
        next: (response: any) => {

          //console.log('DETALLE', response);

          this.saldos = response.entities.map((item: any) => ({
            id: item.id,
            nombre: item.name,
            email: item.email,
            telefono: item.phoneNumber,
            saldoPrincipal: `$${item.balance ?? 0}`,
            saldoGarantia: `$${item.warrantyBalance ?? 0}`,
            saldoPendiente: `$${item.customerNetworkBalance ?? 0}`,
            saldoTarjeta: `$${item.cardAvailableBalance ?? 0}`
          }));

        },
        error: (error) => {
          console.error(error);
        }
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

private obtenerFechaArchivo(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

}
