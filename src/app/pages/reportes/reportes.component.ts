import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReporteArchivo, ReportesService } from '../../services/reportes.service';

type TipoCuentaReporte = 'EMISION' | 'ADQUIRENTE';
type TipoReporte = 'ESTADO_PDF' | 'ESTADO_EXCEL' | 'CORTE_DIA' | 'DIARIO_TRANSACCIONES' | 'TRANSACCIONES_SPLIT' | string;

interface ReporteDisponible {
  id: TipoReporte;
  titulo: string;
  descripcion: string;
  imagen: string;
  variante: 'pdf' | 'excel' | 'corte' | 'diario' | 'split' | 'liquidacion' | 'bancos' | 'comision' | 'conciliacion' | 'internacional' | 'reserva';
  origen: 'fijo' | 'dinamico';
  folder?: string;
}

interface CuentaReporteDisponible {
  id: string;
  texto: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  private readonly reportesFijos: ReporteDisponible[] = [
    {
      id: 'ESTADO_PDF',
      titulo: 'Estado de Cuenta en PDF',
      descripcion: 'Este reporte es correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato PDF',
      imagen: 'assets/reportes/DescargaPDF.png',
      variante: 'pdf',
      origen: 'fijo'
    },
    {
      id: 'ESTADO_EXCEL',
      titulo: 'Estado de Cuenta en EXCEL',
      descripcion: 'Este reporte muestra el reporte correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato Excel',
      imagen: 'assets/reportes/DescargarXLS.png',
      variante: 'excel',
      origen: 'fijo'
    },
    {
      id: 'CORTE_DIA',
      titulo: 'Corte del día',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      imagen: 'assets/reportes/Transacciones.png',
      variante: 'corte',
      origen: 'fijo'
    },
    {
      id: 'DIARIO_TRANSACCIONES',
      titulo: 'Diario de Transacciones',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      imagen: 'assets/reportes/TransaccionesDia.png',
      variante: 'diario',
      origen: 'fijo'
    },
    {
      id: 'TRANSACCIONES_SPLIT',
      titulo: 'Transacciones Split',
      descripcion: 'La información presentada corresponde a las transacciones procesadas considerando la solicitud del cliente para facilidad de análisis y proceso con sus sistemas internos',
      imagen: 'assets/reportes/Split.png',
      variante: 'split',
      origen: 'fijo'
    }
  ];

  private readonly reportesDinamicos: Record<string, Omit<ReporteDisponible, 'id' | 'origen' | 'folder'>> = {
    EnRed: {
      titulo: 'Liquidaciones',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación al comercio.',
      imagen: 'assets/reportes/Liquidacion.png',
      variante: 'liquidacion'
    },
    Factura: {
      titulo: 'Liquidaciones en otros Bancos',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación en otros bancos.',
      imagen: 'assets/reportes/Bancos.png',
      variante: 'bancos'
    },
    Comision: {
      titulo: 'Compensaciones',
      descripcion: 'Reporte de Comisiones en Red y Reporte de Comisiones Fuera de Red.',
      imagen: 'assets/reportes/Compensacion.png',
      variante: 'comision'
    },
    Conciliacion: {
      titulo: 'Conciliación',
      descripcion: 'Ventas pendientes de liquidar y detalle de ventas liquidadas.',
      imagen: 'assets/reportes/Conciliacion.png',
      variante: 'conciliacion'
    },
    Internacionales: {
      titulo: 'Liquidaciones Internacionales',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación al comercio.',
      imagen: 'assets/reportes/Internacional.png',
      variante: 'internacional'
    },
    Reserva: {
      titulo: 'Reserva',
      descripcion: 'Reporte de Comisiones en Red y Reporte de Comisiones Fuera de Red.',
      imagen: 'assets/reportes/Compensacion.png',
      variante: 'reserva'
    }
  };

  cuentas: CuentaReporteDisponible[] = [];
  periodos: string[] = [];
  cuentaSeleccionada = '';
  periodoSeleccionado = '';
  clabe = '';
  mensaje = '';
  mostrarReportes = false;
  cargando = false;
  abriendoReporte = '';

  reportes: ReporteDisponible[] = [...this.reportesFijos];

  constructor(private reportesService: ReportesService) {}

  ngOnInit(): void {
    this.periodos = this.generarPeriodos();
    this.cargarCuentas();
  }

  cargarCuentas(): void {
    this.reportesService.obtenerCuentas().subscribe({
      next: respuesta => {
        this.cuentas = this.normalizarLista(respuesta, [
          'data',
          'accounts',
          'concentratorAccounts',
          'accountList'
        ])
          .filter(cuenta => this.debeMostrarCuenta(cuenta))
          .map(cuenta => ({
            id: this.obtenerValorCuenta(cuenta),
            texto: this.obtenerTextoCuenta(cuenta)
          }))
          .filter(cuenta => !!cuenta.id);
      },
      error: () => {
        this.mensaje = 'No fue posible cargar las cuentas.';
      }
    });
  }

  onCuentaChange(): void {
    this.clabe = '';
    this.mostrarReportes = false;
    this.reportes = [...this.reportesFijos];

    if (!this.cuentaSeleccionada) return;

    this.reportesService.obtenerSaldo(this.cuentaSeleccionada).subscribe({
      next: respuesta => {
        const rows = respuesta?.rows || respuesta?.onsignaEntity || respuesta?.data || respuesta;
        this.clabe = rows?.clabeAccount || rows?.virtualAccount || '';
      },
      error: () => {
        this.mensaje = 'No fue posible obtener la CLABE de la cuenta.';
      }
    });
  }

  consultar(): void {
    this.mensaje = '';
    this.mostrarReportes = false;

    if (!this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Selecciona una cuenta y un periodo.';
      return;
    }

    this.cargando = true;
    this.reportes = [...this.reportesFijos];

    this.reportesService.buscarFolderReportes(this.periodoSeleccionado, this.obtenerTipoCuentaSeleccionada())
      .pipe(
        catchError(() => of([] as ReporteArchivo[])),
        finalize(() => {
          this.cargando = false;
          this.mostrarReportes = true;
        })
      )
      .subscribe(respuesta => {
        const carpetas = this.extraerRows(respuesta);
        const dinamicos = carpetas
          .map(item => item.name || '')
          .filter(nombre => !!nombre && !!this.reportesDinamicos[nombre])
          .map(nombre => ({
            id: nombre,
            folder: nombre,
            origen: 'dinamico' as const,
            ...this.reportesDinamicos[nombre]
          }));

        this.reportes = [...this.reportesFijos, ...dinamicos];
      });
  }

  verReporte(reporte: ReporteDisponible): void {
    this.mensaje = '';

    if (!this.mostrarReportes || !this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Primero consulta con una cuenta y un periodo.';
      return;
    }

    this.abriendoReporte = reporte.id;

    if (reporte.origen === 'dinamico') {
      this.verReporteDinamico(reporte);
      return;
    }

    this.verReporteFijo(reporte);
  }

  private verReporteDinamico(reporte: ReporteDisponible): void {
    this.reportesService.buscarArchivosReporte(this.periodoSeleccionado, this.obtenerTipoCuentaSeleccionada(), reporte.folder || reporte.id)
      .pipe(finalize(() => this.abriendoReporte = ''))
      .subscribe({
        next: respuesta => {
          const archivo = this.extraerRows(respuesta).find(item => !!item.url);

          if (archivo?.url) {
            window.open(archivo.url, '_blank');
            return;
          }

          this.mensaje = `No se encontró archivo para "${reporte.titulo}".`;
        },
        error: () => {
          this.mensaje = `No fue posible abrir "${reporte.titulo}".`;
        }
      });
  }

  private verReporteFijo(reporte: ReporteDisponible): void {
    const cuenta = this.cuentaSeleccionada;
    const clabe = this.clabe;
    const request$ = reporte.id === 'ESTADO_PDF'
      ? this.reportesService.obtenerEstadoCuenta('PDF', this.periodoSeleccionado, cuenta, clabe)
      : reporte.id === 'ESTADO_EXCEL'
        ? this.reportesService.obtenerEstadoCuenta('EXCEL', this.periodoSeleccionado, cuenta, clabe)
        : reporte.id === 'CORTE_DIA'
          ? this.reportesService.obtenerCorteDia(this.periodoSeleccionado)
          : reporte.id === 'DIARIO_TRANSACCIONES'
            ? this.reportesService.obtenerDiarioTransacciones(this.periodoSeleccionado)
            : this.reportesService.obtenerTransaccionesSplit(this.periodoSeleccionado, cuenta);

    request$
      .pipe(finalize(() => this.abriendoReporte = ''))
      .subscribe({
        next: respuesta => this.descargarRespuestaReporte(respuesta, reporte),
        error: () => {
          this.mensaje = `No fue posible generar "${reporte.titulo}".`;
        }
      });
  }

  private descargarRespuestaReporte(respuesta: any, reporte: ReporteDisponible): void {
    const base64 = respuesta?.reportFile?.base64 || respuesta?.rows?.reportFile?.base64;

    if (!base64) {
      this.mensaje = `El servicio no regresó archivo para "${reporte.titulo}".`;
      return;
    }

    const extension = reporte.id === 'ESTADO_PDF' ? 'pdf' : 'xlsx';
    const mimeType = extension === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = this.base64ABlob(base64, mimeType);
    const url = URL.createObjectURL(blob);

    if (extension === 'pdf') {
      window.open(url, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reporte.titulo}-${this.periodoSeleccionado}.${extension}`;
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  private extraerRows(respuesta: any): ReporteArchivo[] {
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta?.rows)) return respuesta.rows;
    return [];
  }

  obtenerValorCuenta(cuenta: any): string {
    return cuenta?.idSirio || cuenta?.sirioId || cuenta?.id || cuenta?.bundle || cuenta?.entitySonID || '';
  }

  obtenerTextoCuenta(cuenta: any): string {
    return cuenta?.name || cuenta?.nombre || cuenta?.businessName || cuenta?.bussinesName || this.obtenerValorCuenta(cuenta);
  }

  private obtenerTipoCuentaSeleccionada(): TipoCuentaReporte {
    const cuenta = this.cuentas.find(item => item.id === this.cuentaSeleccionada);
    const texto = (cuenta?.texto || '').toLowerCase();

    return texto.includes('adquir') ? 'ADQUIRENTE' : 'EMISION';
  }

  private debeMostrarCuenta(cuenta: any): boolean {
    const idPerfil = Number(localStorage.getItem('idPerfil') || 0);

    if (idPerfil === 5) {
      return true;
    }

    return this.obtenerTextoCuenta(cuenta) !== 'Cuenta Reserva';
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    let current = response;

    for (const key of keys) {
      current = current?.[key];

      if (Array.isArray(current)) {
        return current;
      }
    }

    if (current && typeof current === 'object') {
      return [current];
    }

    return [];
  }

  private base64ABlob(base64: string, mimeType: string): Blob {
    const contenidoBinario = atob(base64);
    const bytes = new Uint8Array(contenidoBinario.length);

    for (let i = 0; i < contenidoBinario.length; i++) {
      bytes[i] = contenidoBinario.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
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
