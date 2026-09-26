import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { finalize, Subscription, timeout } from 'rxjs';
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
export class ReportesComponent implements OnInit, OnDestroy {
  private consultaSubscription?: Subscription;
  private saldoSubscription?: Subscription;
  private reporteSubscription?: Subscription;
  private readonly assetBaseUrl = `${window.location.origin}/`;
  private readonly reporteTimeoutMs = 90000;

  private readonly reportesFijos: ReporteDisponible[] = [
    {
      id: 'ESTADO_PDF',
      titulo: 'Estado de Cuenta en PDF',
      descripcion: 'Este reporte es correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato PDF',
      imagen: this.assetUrl('assets/reportes/DescargaPDF.png'),
      variante: 'pdf',
      origen: 'fijo'
    },
    {
      id: 'ESTADO_EXCEL',
      titulo: 'Estado de Cuenta en EXCEL',
      descripcion: 'Este reporte muestra el reporte correspondiente al periodo de consulta, proporcionando el detalle de los movimientos registrados, incluyendo cargos, abonos, saldos y demás operaciones, descarga en formato Excel',
      imagen: this.assetUrl('assets/reportes/DescargarXLS.png'),
      variante: 'excel',
      origen: 'fijo'
    },
    {
      id: 'CORTE_DIA',
      titulo: 'Corte del día',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      imagen: this.assetUrl('assets/reportes/Transacciones.png'),
      variante: 'corte',
      origen: 'fijo'
    },
    {
      id: 'DIARIO_TRANSACCIONES',
      titulo: 'Diario de Transacciones',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, no esta ligada al periodo de tiempo seleccionado del filtro superior',
      imagen: this.assetUrl('assets/reportes/TransaccionesDia.png'),
      variante: 'diario',
      origen: 'fijo'
    },
    {
      id: 'TRANSACCIONES_SPLIT',
      titulo: 'Transacciones Split',
      descripcion: 'La información presentada corresponde a las transacciones procesadas considerando la solicitud del cliente para facilidad de análisis y proceso con sus sistemas internos',
      imagen: this.assetUrl('assets/reportes/Split.png'),
      variante: 'split',
      origen: 'fijo'
    }
  ];

  private readonly reportesDinamicos: Record<string, Omit<ReporteDisponible, 'id' | 'origen' | 'folder'>> = {
    EnRed: {
      titulo: 'Liquidaciones',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación al comercio.',
      imagen: this.assetUrl('assets/reportes/Liquidacion.png'),
      variante: 'liquidacion'
    },
    Factura: {
      titulo: 'Liquidaciones en otros Bancos',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación en otros bancos.',
      imagen: this.assetUrl('assets/reportes/Bancos.png'),
      variante: 'bancos'
    },
    Comision: {
      titulo: 'Compensaciones',
      descripcion: 'Reporte de Comisiones en Red y Reporte de Comisiones Fuera de Red.',
      imagen: this.assetUrl('assets/reportes/Compensacion.png'),
      variante: 'comision'
    },
    Conciliacion: {
      titulo: 'Conciliación',
      descripcion: 'Ventas pendientes de liquidar y detalle de ventas liquidadas.',
      imagen: this.assetUrl('assets/reportes/Conciliacion.png'),
      variante: 'conciliacion'
    },
    Internacionales: {
      titulo: 'Liquidaciones Internacionales',
      descripcion: 'Dashboard ejecutivo, liquidaciones pendientes, detalle de transacciones liquidadas y liquidación al comercio.',
      imagen: this.assetUrl('assets/reportes/Internacional.png'),
      variante: 'internacional'
    },
    Reserva: {
      titulo: 'Reserva',
      descripcion: 'Reporte de Comisiones en Red y Reporte de Comisiones Fuera de Red.',
      imagen: this.assetUrl('assets/reportes/Compensacion.png'),
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

  reportes: ReporteDisponible[] = [];

  constructor(private reportesService: ReportesService) {}

  private assetUrl(path: string): string {
    return `${this.assetBaseUrl}${path}`;
  }

  ngOnInit(): void {
    this.periodos = this.generarPeriodos();
    this.cargarCuentas();
  }

  ngOnDestroy(): void {
    this.consultaSubscription?.unsubscribe();
    this.saldoSubscription?.unsubscribe();
    this.reporteSubscription?.unsubscribe();
  }

  onPeriodoChange(): void {
    this.limpiarResultados();
  }

  private limpiarResultados(): void {
    this.consultaSubscription?.unsubscribe();
    this.reporteSubscription?.unsubscribe();
    this.mensaje = '';
    this.mostrarReportes = false;
    this.reportes = [];
  }

  cargarCuentas(): void {
    this.reportesService.obtenerCuentas().subscribe({
      next: respuesta => {
        this.cuentas = this.normalizarLista(respuesta, [
          'cuentas',
          'rows',
          'data',
          'accounts',
          'concentratorAccounts',
          'accountList',
          'contextResponse'
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
    this.saldoSubscription?.unsubscribe();
    this.limpiarResultados();
    this.clabe = '';

    if (!this.cuentaSeleccionada) return;

    this.saldoSubscription = this.reportesService.obtenerSaldo(this.cuentaSeleccionada).subscribe({
      next: respuesta => {
        const rows = respuesta?.rows || respuesta?.data || respuesta;
        const cuenta = rows?.onsignaEntity || respuesta?.onsignaEntity || rows;
        this.clabe = cuenta?.clabeAccount || cuenta?.virtualAccount || '';
        if (!this.clabe) {
          this.mensaje = rows?.error?.message || respuesta?.message || 'No fue posible obtener la CLABE de la cuenta.';
        }
      },
      error: () => {
        this.mensaje = 'No fue posible obtener la CLABE de la cuenta.';
      }
    });
  }

  consultar(): void {
    this.limpiarResultados();

    if (!this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Selecciona una cuenta y un periodo.';
      return;
    }

    // Estos reportes no dependen de los archivos encontrados en el directorio.
    const reportesFijos = this.obtenerReportesFijosDisponibles();
    this.reportes = [...reportesFijos];
    this.mostrarReportes = true;
    this.cargando = true;

    this.consultaSubscription = this.reportesService.buscarFolderReportes(this.periodoSeleccionado, this.obtenerTipoCuentaSeleccionada())
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({ next: respuesta => {
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

        this.reportes = [...this.obtenerReportesFijosDisponibles(), ...dinamicos];
      }, error: () => {
        this.mensaje = 'No fue posible consultar los reportes adicionales. Los reportes generales siguen disponibles.';
      }
      });
  }

  verReporte(reporte: ReporteDisponible): void {
    if (this.abriendoReporte) return;
    this.mensaje = '';

    if (!this.mostrarReportes || !this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Primero consulta con una cuenta y un periodo.';
      return;
    }

    if (reporte.id === 'TRANSACCIONES_SPLIT' && !this.puedeMostrarSplit()) {
      this.mensaje = 'El reporte Split no está disponible para la cuenta seleccionada.';
      return;
    }

    this.abriendoReporte = reporte.id;
    const ventanaReporte = ['ESTADO_PDF', 'ESTADO_EXCEL'].includes(reporte.id) ? null : window.open('', '_blank');

    if (reporte.origen === 'dinamico') {
      this.verReporteDinamico(reporte, ventanaReporte);
      return;
    }

    this.verReporteFijo(reporte, ventanaReporte);
  }

  private verReporteDinamico(reporte: ReporteDisponible, ventanaReporte: Window | null): void {
    this.reporteSubscription = this.reportesService.buscarArchivosReporte(this.periodoSeleccionado, this.obtenerTipoCuentaSeleccionada(), reporte.folder || reporte.id)
      .pipe(finalize(() => this.abriendoReporte = ''))
      .subscribe({
        next: respuesta => {
          const archivo = this.extraerRows(respuesta).find(item => !!item.url);

          if (archivo?.url) {
            this.abrirUrlReporte(archivo.url, ventanaReporte);
            return;
          }

          ventanaReporte?.close();
          this.mensaje = `No se encontró archivo para "${reporte.titulo}".`;
        },
        error: () => {
          ventanaReporte?.close();
          this.mensaje = `No fue posible abrir "${reporte.titulo}".`;
        }
      });
  }

  private verReporteFijo(reporte: ReporteDisponible, ventanaReporte: Window | null): void {
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

    this.reporteSubscription = request$
      .pipe(
        timeout(this.reporteTimeoutMs),
        finalize(() => this.abriendoReporte = '')
      )
      .subscribe({
        next: respuesta => this.descargarRespuestaReporte(respuesta, reporte, ventanaReporte),
        error: error => {
          ventanaReporte?.close();
          this.mensaje = error?.name === 'TimeoutError'
            ? `El servicio tardó demasiado en generar "${reporte.titulo}". Intenta de nuevo o selecciona otro periodo.`
            : `No fue posible generar "${reporte.titulo}".`;
        }
      });
  }

  private descargarRespuestaReporte(respuesta: any, reporte: ReporteDisponible, ventanaReporte: Window | null): void {
    const base64 = this.extraerBase64Reporte(respuesta);

    if (!base64) {
      ventanaReporte?.close();
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
      saveAs(blob, `estado-cuenta-${this.periodoSeleccionado}.${extension}`);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reporte.titulo}-${this.periodoSeleccionado}.${extension}`;
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  private abrirUrlReporte(url: string, ventanaReporte: Window | null): void {
    if (ventanaReporte && !ventanaReporte.closed) {
      ventanaReporte.location.href = url;
      return;
    }

    window.open(url, '_blank');
  }

  private descargarArchivo(url: string, nombreArchivo: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.click();
  }

  private extraerBase64Reporte(respuesta: any): string {
    const posiblesValores = [
      respuesta?.reportFile?.base64,
      respuesta?.rows?.reportFile?.base64,
      respuesta?.data?.reportFile?.base64,
      respuesta?.base64,
      respuesta?.rows?.base64,
      respuesta?.data?.base64,
      respuesta?.file,
      respuesta?.rows?.file,
      respuesta?.data?.file,
      respuesta?.reportFile,
      respuesta?.rows?.reportFile,
      respuesta?.data?.reportFile,
    ];

    const valor = posiblesValores.find(item => typeof item === 'string' && item.trim());
    return typeof valor === 'string' ? valor.trim() : '';
  }

  private extraerRows(respuesta: any): ReporteArchivo[] {
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta?.rows)) return respuesta.rows;
    return [];
  }

  obtenerValorCuenta(cuenta: any): string {
    return String(
      cuenta?.idNode
      ?? cuenta?.nodeID
      ?? cuenta?.idSirio
      ?? cuenta?.sirioId
      ?? cuenta?.id
      ?? cuenta?.bundle
      ?? cuenta?.entitySonID
      ?? ''
    );
  }

  obtenerTextoCuenta(cuenta: any): string {
    return cuenta?.name || cuenta?.nombre || cuenta?.businessName || cuenta?.bussinesName || this.obtenerValorCuenta(cuenta);
  }

  private obtenerTipoCuentaSeleccionada(): TipoCuentaReporte {
    const cuenta = this.cuentas.find(item => item.id === this.cuentaSeleccionada);
    const texto = (cuenta?.texto || '').toLowerCase();

    return texto.includes('adquir') ? 'ADQUIRENTE' : 'EMISION';
  }

  private obtenerReportesFijosDisponibles(): ReporteDisponible[] {
    return this.reportesFijos.filter(reporte => reporte.id !== 'TRANSACCIONES_SPLIT' || this.puedeMostrarSplit());
  }

  private puedeMostrarSplit(): boolean {
    const cuenta = this.cuentas.find(item => item.id === this.cuentaSeleccionada);
    const nombre = (cuenta?.texto || '').trim().toLocaleLowerCase('es-MX');
    const idPerfil = this.obtenerIdPerfil();
    return (idPerfil === 5 && nombre === 'cuenta reserva')
      || (idPerfil === 7 && nombre === 'cuenta adquirente');
  }

  private obtenerIdPerfil(): number {
    try {
      const sesion = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (sesion?.idPerfil != null) return Number(sesion.idPerfil);
    } catch { /* Consultar el valor individual de la sesión. */ }
    return Number(localStorage.getItem('idPerfil') || 0);
  }

  private debeMostrarCuenta(cuenta: any): boolean {
    const idPerfil = this.obtenerIdPerfil();

    if (idPerfil === 5) {
      return true;
    }

    return this.obtenerTextoCuenta(cuenta).trim().toLocaleLowerCase('es-MX') !== 'cuenta reserva';
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];

    for (const key of keys) {
      const value = response[key];
      if (Array.isArray(value)) return value;

      if (value && typeof value === 'object') {
        const nested = this.normalizarLista(value, keys);
        if (nested.length) return nested;
      }
    }

    for (const value of Object.values(response)) {
      if (Array.isArray(value)) return value;

      if (value && typeof value === 'object') {
        const nested = this.normalizarLista(value, keys);
        if (nested.length) return nested;
      }
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
