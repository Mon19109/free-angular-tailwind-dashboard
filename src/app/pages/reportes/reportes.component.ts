import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { finalize, Subscription, timeout } from 'rxjs';
import { CuentaReporte, FiltroReporte, TipoDescarga, ReportesService } from '../../services/reportes.service';

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
  guidComerce: string;
}

interface EntidadReporteDisponible {
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
  private readonly sessionAuth = inject(AuthService);
  private consultaSubscription?: Subscription;
  private reporteSubscription?: Subscription;
  private entidadesSubscription?: Subscription;
  private cuentasSubscription?: Subscription;
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
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, utilizando el periodo seleccionado del filtro superior',
      imagen: this.assetUrl('assets/reportes/Transacciones.png'),
      variante: 'corte',
      origen: 'fijo'
    },
    {
      id: 'DIARIO_TRANSACCIONES',
      titulo: 'Diario de Transacciones',
      descripcion: 'La información presentada corresponde a las transacciones procesadas al corte del día, utilizando el periodo seleccionado del filtro superior',
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
  entidades: EntidadReporteDisponible[] = [];
  mostrarEntidades = false;
  entidadSeleccionada = '';
  periodos: string[] = [];
  cuentaSeleccionada = '';
  guidComerceSeleccionado = '';
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
    const idPerfil = this.obtenerIdPerfil();
    this.mostrarEntidades = idPerfil === 8 || idPerfil === 9;
    if (this.mostrarEntidades) {
      this.cargarEntidades();
    } else {
      this.cargarCuentas();
    }
  }

  ngOnDestroy(): void {
    this.consultaSubscription?.unsubscribe();
    this.reporteSubscription?.unsubscribe();
    this.entidadesSubscription?.unsubscribe();
    this.cuentasSubscription?.unsubscribe();
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

  cargarEntidades(): void {
    this.entidadesSubscription?.unsubscribe();
    // For profiles 8/9 this endpoint returns the authorized tree, not accounts of a selected entity.
    this.entidadesSubscription = this.reportesService.obtenerCuentas().subscribe({
      next: respuesta => {
        this.entidades = respuesta.cuentas.filter(cuenta => cuenta.levelType === 4 && cuenta.idSirio)
          .map(cuenta => ({ id: cuenta.idSirio, texto: cuenta.name }));
        this.mensaje = 'La consulta de cuentas por entidad está pendiente de integración.';
      },
      error: (error: unknown) => { this.mensaje = this.errorConsulta(error, 'No fue posible cargar las entidades.'); }
    });
  }

  onEntidadChange(): void {
    this.cuentasSubscription?.unsubscribe();
    this.cuentaSeleccionada = '';
    this.guidComerceSeleccionado = '';
    this.clabe = '';
    this.cuentas = [];
    this.limpiarResultados();
    this.mensaje = 'La consulta de cuentas por entidad está pendiente de integración.';
  }

  cargarCuentas(): void {
    this.cuentasSubscription?.unsubscribe();
    this.cuentasSubscription = this.reportesService.obtenerCuentas().subscribe({
      next: respuesta => {
        this.cuentas = respuesta.cuentas.filter(cuenta => this.debeMostrarCuenta(cuenta) && cuenta.idSirio)
          .map(cuenta => ({ id: cuenta.idSirio, texto: cuenta.name, guidComerce: cuenta.guidCommerce }));
      },
      error: (error: unknown) => { this.mensaje = this.errorConsulta(error, 'No fue posible cargar las cuentas.'); }
    });
  }

  onCuentaChange(): void {
    this.limpiarResultados();
    this.clabe = '';
    this.guidComerceSeleccionado = this.cuentas.find(cuenta => cuenta.id === this.cuentaSeleccionada)?.guidComerce || '';

    if (this.cuentaSeleccionada) {
      this.mensaje = 'La consulta de saldo y CLABE está pendiente de integración. Los estados de cuenta se solicitan sin CLABE.';
    }
  }

  private filtroSeleccionado(): FiltroReporte | undefined {
    const cuenta = this.cuentas.find(item => item.id === this.cuentaSeleccionada);
    const tipos: Record<string, FiltroReporte['tipoCuenta']> = {
      'cuenta adquirente': 'Cuenta Adquirente', 'cuenta emision': 'Cuenta Emision',
      'cuenta emisión': 'Cuenta Emisión', 'cuenta reserva': 'Cuenta Reserva'
    };
    const tipoCuenta = tipos[cuenta?.texto.trim().toLocaleLowerCase('es-MX') ?? ''];
    if (!cuenta || !tipoCuenta) return undefined;
    return { periodo: this.periodoSeleccionado, cuenta: cuenta.id, guid: cuenta.guidComerce,
      tipoCuenta };
  }

  private errorConsulta(error: unknown, respaldo: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const body = error.error;
      if (body && typeof body === 'object' && 'code' in body && body.code === 'REPORTES_AUTHORIZATION_UNAVAILABLE') {
        return 'La autorización de reportes aún no está disponible.';
      }
    }
    return respaldo;
  }

  consultar(): void {
    this.limpiarResultados();

    if (!this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Selecciona una cuenta y un periodo.';
      return;
    }

    const filtro = this.filtroSeleccionado();
    if (!filtro) { this.mensaje = 'El tipo de cuenta recibido no es compatible con el contrato de reportes.'; return; }

    // Estos reportes no dependen de los archivos encontrados en el directorio.
    const reportesFijos = this.obtenerReportesFijosDisponibles();
    this.reportes = [...reportesFijos];
    this.mostrarReportes = true;
    this.cargando = true;

    this.consultaSubscription = this.reportesService.buscar(filtro)
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({ next: respuesta => {
        const carpetas = this.extraerRows(respuesta.rows);
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
      }, error: (error: unknown) => {
        this.mostrarReportes = false;
        this.reportes = [];
        this.mensaje = this.errorConsulta(error, 'No fue posible consultar los reportes.');
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
    if (reporte.origen === 'dinamico') {
      this.verReporteDinamico(reporte);
      return;
    }
    this.verReporteFijo(reporte);
  }

  private verReporteDinamico(reporte: ReporteDisponible): void {
    const filtro = this.filtroSeleccionado();
    if (!filtro) { this.abriendoReporte = ''; return; }
    this.reporteSubscription = this.reportesService.buscarReporte(filtro, reporte.folder || reporte.id)
      .pipe(finalize(() => this.abriendoReporte = ''))
      .subscribe({
        next: () => {
          this.mensaje = 'La búsqueda de archivos está disponible, pero su descarga mediante el BFF está pendiente de integración.';
        },
        error: (error: unknown) => { this.mensaje = this.errorConsulta(error, `No fue posible consultar "${reporte.titulo}".`); }
      });
  }

  private verReporteFijo(reporte: ReporteDisponible): void {
    const tipos: Record<string, TipoDescarga> = { ESTADO_PDF: 'estado-pdf', ESTADO_EXCEL: 'estado-excel',
      CORTE_DIA: 'transacciones', DIARIO_TRANSACCIONES: 'diario', TRANSACCIONES_SPLIT: 'split' };
    const tipo = tipos[reporte.id];
    if (!tipo) { this.abriendoReporte = ''; return; }
    this.reporteSubscription = this.reportesService.descargar(tipo, {
      periodo: this.periodoSeleccionado, cuenta: this.cuentaSeleccionada, clabe: this.clabe
    }).pipe(timeout(this.reporteTimeoutMs), finalize(() => this.abriendoReporte = '')).subscribe({
      next: archivo => {
        if (!archivo.size) { this.mensaje = `El servicio no regresó archivo para "${reporte.titulo}".`; return; }
        const extension = tipo === 'estado-pdf' ? 'pdf' : 'xlsx';
        this.reportesService.guardarArchivo(archivo, `${reporte.titulo}-${this.periodoSeleccionado}.${extension}`);
      },
      error: (error: unknown) => {
        this.mensaje = error instanceof Error && error.name === 'TimeoutError'
          ? `El servicio tardó demasiado en generar "${reporte.titulo}". Intenta de nuevo o selecciona otro periodo.`
          : this.errorConsulta(error, `No fue posible generar "${reporte.titulo}".`);
      }
    });
  }

  private extraerRows(rows: unknown): Array<{ name: string }> {
    if (!Array.isArray(rows)) {
      this.mensaje = 'El formato del directorio de reportes no es compatible.';
      return [];
    }
    return rows.filter((item: unknown): item is { name: string } =>
      !!item && typeof item === 'object' && 'name' in item && typeof item.name === 'string');
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
    return Number(this.sessionAuth.getSessionValue('idPerfil') || 0);
  }

  private debeMostrarCuenta(cuenta: CuentaReporte): boolean {
    const idPerfil = this.obtenerIdPerfil();

    if (idPerfil === 5) {
      return true;
    }

    return cuenta.name.trim().toLocaleLowerCase('es-MX') !== 'cuenta reserva';
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
