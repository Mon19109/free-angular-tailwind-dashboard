import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TipoCuentaReporte = 'EMISION' | 'ADQUIRENTE';
type TipoReporte = 'ESTADO_PDF' | 'ESTADO_EXCEL' | 'CORTE_DIA' | 'DIARIO_TRANSACCIONES';

interface ReporteDisponible {
  id: TipoReporte;
  titulo: string;
  descripcion: string;
  icono: string;
  variante: 'pdf' | 'excel' | 'corte' | 'diario';
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  tiposCuenta = [
    { valor: 'EMISION' as TipoCuentaReporte, texto: 'Cuenta Emisión' },
    { valor: 'ADQUIRENTE' as TipoCuentaReporte, texto: 'Cuenta Adquirente' }
  ];

  periodos: string[] = [];
  cuentaSeleccionada: TipoCuentaReporte | '' = '';
  periodoSeleccionado = '';
  mensaje = '';
  mostrarReportes = false;
  cargando = false;

  reportes: ReporteDisponible[] = [
    {
      id: 'ESTADO_PDF',
      titulo: 'Estado de Cuenta en PDF',
      descripcion: 'Este reporte es correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato PDF',
      icono: 'far fa-file-pdf',
      variante: 'pdf'
    },
    {
      id: 'ESTADO_EXCEL',
      titulo: 'Estado de Cuenta en EXCEL',
      descripcion: 'Este reporte muestra el reporte correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato Excel',
      icono: 'far fa-file-excel',
      variante: 'excel'
    },
    {
      id: 'CORTE_DIA',
      titulo: 'Corte del día',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      icono: 'far fa-copy',
      variante: 'corte'
    },
    {
      id: 'DIARIO_TRANSACCIONES',
      titulo: 'Diario de Transacciones',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      icono: 'far fa-clipboard',
      variante: 'diario'
    }
  ];

  ngOnInit(): void {
    this.periodos = this.generarPeriodos();
  }

  consultar(): void {
    this.mensaje = '';

    if (!this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mostrarReportes = false;
      this.mensaje = 'Selecciona una cuenta y un periodo.';
      return;
    }

    this.mostrarReportes = true;
  }

  verReporte(reporte: ReporteDisponible): void {
    this.mensaje = '';

    if (!this.mostrarReportes || !this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Primero consulta con una cuenta y un periodo.';
      return;
    }

    this.mensaje = `El reporte "${reporte.titulo}" aun no tiene descarga configurada.`;
  }

  private generarPeriodos(): string[] {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];
    const fecha = new Date();
    const anioActual = fecha.getFullYear();
    const mesActual = fecha.getMonth();
    const periodos: string[] = [];

    for (let anio = anioActual; anio >= anioActual - 10; anio--) {
      const ultimoMes = anio === anioActual ? mesActual : 11;

      for (let mes = 0; mes <= ultimoMes; mes++) {
        periodos.push(`${anio} ${meses[mes]}`);
      }
    }

    return periodos;
  }
}
