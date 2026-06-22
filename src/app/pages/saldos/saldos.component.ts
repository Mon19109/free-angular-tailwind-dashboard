import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaldosService } from '../../services/saldos.service';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
//import * as XLSX from 'xlsx';
//import { saveAs } from 'file-saver';

@Component({
  selector: 'app-saldos',
  standalone: true,
  imports: [CommonModule],
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

  const url =
  `https://sdbx-portal-antares.kashplataforma.com/public/assets/php/exportar_detalle_pdf.php?urlRep=http://10.15.5.171&fatherID=${this.fatherIDActual}&type=1&status=25&total=${this.saldos.length}`;

  window.open(url, '_blank');

}

exportarExcel(): void {

  const data = this.saldos.map(item => ({
    ID: item.id,
    Nombre: item.nombre,
    Email: item.email,
    Telefono: item.telefono,
    SaldoPrincipal: item.saldoPrincipal,
    SaldoGarantia: item.saldoGarantia,
    SaldoPendiente: item.saldoPendiente,
    SaldoTarjeta: item.saldoTarjeta
  }));

 /* const worksheet = XLSX.utils.json_to_sheet(data);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'DetalleSaldos'
  );

  const excelBuffer =
    XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

  const blob = new Blob(
    [excelBuffer],
    {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  );*/

  const fecha = new Date();

  const nombreArchivo =
    `DetalleSaldos-${fecha.getFullYear()}-${
      String(fecha.getMonth() + 1).padStart(2, '0')
    }-${
      String(fecha.getDate()).padStart(2, '0')
    }_${
      String(fecha.getHours()).padStart(2, '0')
    }_${
      String(fecha.getMinutes()).padStart(2, '0')
    }_${
      String(fecha.getSeconds()).padStart(2, '0')
    }.xlsx`;

  //saveAs(blob, nombreArchivo);

}

}