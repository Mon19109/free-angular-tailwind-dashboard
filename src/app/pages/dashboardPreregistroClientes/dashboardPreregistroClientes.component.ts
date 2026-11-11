import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConsultaComercioApi, ConsultaComerciosService } from '../../services/consulta-comercios.service';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';
import { forkJoin } from 'rxjs';

type NivelComercio = 'todos' | 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' | 'prospectos' | 'pendiente-core' | 'pendientes';
type EstatusComercio = string;
type PaginaVisible = { tipo: 'pagina'; valor: number } | { tipo: 'ellipsis'; valor: '...' };
type FiltroJerarquia = 'entidad' | 'sucursal' | 'caja';

interface Comercio {
  ref?: string;
  idComercio: string;
  entitySonID?: string;
  nodoId?: string;
  nodeID?: string;
  guid?: string;
  nivel: 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja' | 'Prospecto';
  jerarquia: string;
  nombreComercial: string;
  razonSocial: string;
  rfc: string;
  correo: string;
  telefono: string;
  estatus: EstatusComercio;
  statusOriginal?: string;
  cajaPinRapido?: boolean;
  typeOfBusiness?: number;
  password?: string;
  tieneInferiores?: boolean;
  cuentaLiquidacion?: boolean;
  pldID?: string;
}

@Component({
  selector: 'app-dashboard-preregistro-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessingOverlayComponent],
 templateUrl: './dashboardPreregistroClientes.component.html',
styleUrls: ['./dashboardPreregistroClientes.component.css']
})
export class DashboardPreregistroClientesComponent {

  readonly pasosPreregistro = [
    {
      paso: 1,
      nombre: 'PROSPECTO',
      status: 'PROSPECTO_ADMIN',
      color: '#3b82f6'
    },
    {
      paso: 2,
      nombre: 'EN REVISIÓN DOCUMENTACIÓN',
      status: '30',
      color: '#6366f1'
    },
    {
      paso: 3,
      nombre: 'EN VALIDACIÓN DOCUMENTACIÓN MD',
      status: null,
      color: '#a855f7'
    },
    {
      paso: 4,
      nombre: 'PENDIENTE CUENTAS LIQUIDACIÓN',
      status: '31',
      color: '#ec4899'
    },
    {
      paso: 5,
      nombre: 'EN VALIDACIÓN CARTA Y CARÁTULA EDC',
      status: null,
      color: '#f43f5e'
    },
    {
      paso: 6,
      nombre: 'PENDIENTE DE AFILIACIÓN',
      status: null,
      color: '#f97316'
    },
    {
      paso: 7,
      nombre: 'PENDIENTE FIRMA DE CONTRATO',
      status: null,
      color: '#eab308'
    },
    {
      paso: 8,
      nombre: 'CLIENTE',
      status: null,
      color: '#10b981'
    }
  ];

  pasoSeleccionado: number | null = null;

  seleccionarPaso(paso: number): void {
    this.pasoSeleccionado =
      this.pasoSeleccionado === paso ? null : paso;

    this.filtros.nivel = 'todos';
    this.paginaActual = 1;
    this.buscar();
  }

  // Temporal: habilitar solo después de migrar edición y caja al BFF.
  readonly accionesInternasHabilitadas = false;

  get mostrarAcciones(): boolean {
  return this.obtenerIdRolSesion() === 2;
}
  constructor(
    private router: Router,
    private consultaComerciosService: ConsultaComerciosService,
    private recuperarCuentaService: RecuperarCuentaService,
    private auth: AuthService
  ) {
    this.buscar();
  }

  readonly niveles = [
    { id: 'todos' as NivelComercio, label: 'Todos los niveles', icon: 'fa-layer-group' },
    { id: 'sub-afiliado' as NivelComercio, label: 'Sub Afiliado', icon: 'fa-user-tie' },
    { id: 'entidad' as NivelComercio, label: 'Entidad', icon: 'fa-building' },
    { id: 'sucursal' as NivelComercio, label: 'Sucursal', icon: 'fa-store' },
    { id: 'caja' as NivelComercio, label: 'Caja', icon: 'fa-cash-register' },
    { id: 'prospectos' as NivelComercio, label: 'Prospectos', icon: 'fa-user-clock' },
    { id: 'pendiente-core' as NivelComercio, label: 'Pendiente autorización CORE', icon: 'fa-user-clock' }
  ];

  get nivelesVisibles() {
    return this.niveles.filter(nivel => nivel.id === 'todos' || this.tieneComerciosPorNivel(nivel.id));
  }

  private tieneComerciosPorNivel(nivel: NivelComercio): boolean {
    if (nivel === 'pendiente-core') {
      return this.comercios.some(comercio => this.esPendienteAutorizacionCore(comercio.statusOriginal));
    }
    return this.comercios.some(comercio =>
      nivel === 'prospectos'
        ? this.esProspectoAdmin(comercio)
        : this.normalizarNivel(comercio.nivel) === nivel
    );
  }

  filtros = {
    nivel: 'todos' as NivelComercio,
    entidad: '',
    sucursal: '',
    caja: '',
    nombre: '',
    rfc: '',
    correo: ''
  };

  comercios: Comercio[] = [];
  resultados = [...this.comercios];
  get soloPendientesRevision(): boolean {
    return this.filtros.nivel === 'pendientes';
  }

  get hayPendientesRevision(): boolean {
    return this.comercios.some(comercio => this.esPendienteRevision(comercio.statusOriginal));
  }

  get soloPendientesAutorizacionCore(): boolean {
    return this.filtros.nivel === 'pendiente-core';
  }

  private esPendienteRevision(status: unknown): boolean {
    const valor = this.normalizarTexto(String(status ?? '')).replace(/[\s_]+/g, '_');
    return valor === '27' || valor === 'PENDIENTE_REVISION';
  }

  private esPendienteAutorizacionCore(status: unknown): boolean {
    return this.normalizarTexto(String(status ?? '')) === 'PENDIENTE AUTORIZACION CORE';
  }

  cargando = false;
  errorConsulta = '';
  paginaActual = 1;
  elementosPorPagina = 10;
  busquedaTabla = '';
  exportMenuAbierto = false;
  accionesAbiertas: string | null = null;
  modalConfirmacion: { tipo: 'inactivar' | 'baja'; comercio: Comercio } | null = null;
  modalPassword: Comercio | null = null;
  modalCambiarPassword: Comercio | null = null;
  nuevaPassword = '';
  confirmarPassword = '';
  cargandoPassword = false;
  guardandoPassword = false;
  errorPassword = '';
  mensajePassword = '';
  mostrarPassword = false;
  mostrarNuevaPassword = false;
  mostrarConfirmarPassword = false;

  get resultadosFiltradosTabla(): Comercio[] {
    const termino = this.busquedaTabla.trim().toLowerCase();
    if (!termino) return this.ordenarComoArbol(this.resultados);

    return this.ordenarComoArbol(
      this.resultados.filter(comercio =>
        Object.values(comercio).some(valor => String(valor).toLowerCase().includes(termino))
      )
    );
  }

  get comerciosPaginados(): Comercio[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.resultadosFiltradosTabla.slice(inicio, inicio + this.elementosPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.resultadosFiltradosTabla.length / this.elementosPorPagina));
  }

  get paginasVisibles(): PaginaVisible[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => ({
        tipo: 'pagina' as const,
        valor: index + 1
      }));
    }

    const paginas = new Set<number>([1, total, actual - 1, actual, actual + 1]);

    if (actual <= 4) {
      [2, 3, 4, 5].forEach(pagina => paginas.add(pagina));
    }

    if (actual >= total - 3) {
      [total - 4, total - 3, total - 2, total - 1].forEach(pagina => paginas.add(pagina));
    }

    const ordenadas = [...paginas]
      .filter(pagina => pagina >= 1 && pagina <= total)
      .sort((a, b) => a - b);

    return ordenadas.reduce<PaginaVisible[]>((acumulado, pagina, index) => {
      const anterior = ordenadas[index - 1];
      if (anterior && pagina - anterior > 1) {
        acumulado.push({ tipo: 'ellipsis', valor: '...' });
      }
      acumulado.push({ tipo: 'pagina', valor: pagina });
      return acumulado;
    }, []);
  }

  get resumen() {
    return {
      comercios: this.resultados.length,
      entidades: this.resultados.filter(item => item.nivel === 'Entidad').length,
      sucursales: this.resultados.filter(item => item.nivel === 'Sucursal').length,
      cajas: this.resultados.filter(item => item.nivel === 'Caja').length
    };
  }

  totalPaso(paso: number): number | null {
  const configuracion = this.pasosPreregistro.find(
    item => item.paso === paso
  );

  if (!configuracion?.status) {
    return null;
  }

  if (this.pasoSeleccionado !== paso) {
    return null;
  }

  return this.resultados.length;
}

  seleccionarNivel(nivel: NivelComercio): void {
    this.filtros.nivel = nivel;
    this.limpiarFiltrosNoAplicables();
    this.buscar();
  }

buscar(): void {
  const paso = this.pasosPreregistro.find(
    item => item.paso === this.pasoSeleccionado
  );

  if (paso && !paso.status) {
    this.comercios = [];
    this.resultados = [];
    this.errorConsulta = 'El estatus de esta etapa aún no está configurado.';
    this.cargando = false;
    this.paginaActual = 1;
    return;
  }

  const estatus = paso?.status
    ? [paso.status]
    : this.pasosPreregistro
        .map(item => item.status)
        .filter((status): status is string => status !== null);

  if (!estatus.length) {
    this.comercios = [];
    this.resultados = [];
    this.errorConsulta = 'No hay estatus configurados.';
    this.cargando = false;
    return;
  }

  this.cargando = true;
  this.errorConsulta = '';

  const consultas = estatus.map(status =>
    this.consultaComerciosService.buscarComercios({
      nameCommerce: this.filtros.nombre.trim(),
      rfc: this.filtros.rfc.trim(),
      email: this.filtros.correo.trim(),
      status
    })
  );

  forkJoin(consultas).subscribe({
    next: respuestas => {
      const respuestaFallida = respuestas.find(
        respuesta => respuesta.success === false
      );

      if (respuestaFallida) {
        this.errorConsulta =
          respuestaFallida.error?.message ||
          'No fue posible consultar los prospectos.';

        this.comercios = [];
        this.resultados = [];
        this.cargando = false;
        return;
      }

      const registros = respuestas.flatMap(
        respuesta => respuesta.commerces ?? []
      );

      const normalizados = this.normalizarComerciosApi(registros);

      const unicos = new Map<string, Comercio>();

      normalizados.forEach((comercio, indice) => {
        const clave = comercio.ref ||
          `${comercio.idComercio}|${comercio.nivel}|${comercio.statusOriginal}|${indice}`;

        unicos.set(clave, comercio);
      });

      this.comercios = this.ordenarComoArbol([...unicos.values()]);

      this.aplicarFiltroNivel();
      this.cargando = false;
    },
    error: () => {
      this.errorConsulta = 'No fue posible consultar los prospectos.';
      this.comercios = [];
      this.resultados = [];
      this.cargando = false;
    }
  });
}


 limpiar(): void {
  this.pasoSeleccionado = null;

  this.filtros = {
    nivel: 'todos',
    entidad: '',
    sucursal: '',
    caja: '',
    nombre: '',
    rfc: '',
    correo: ''
  };

  this.busquedaTabla = '';
  this.paginaActual = 1;
  this.buscar();
}

  filtroVisible(
  filtro: FiltroJerarquia | 'nombre' | 'rfc' | 'correo'
): boolean {
  return true;
}

  private aplicarFiltroNivel(): void {
  const paso = this.pasosPreregistro.find(
    item => item.paso === this.pasoSeleccionado
  );

  const estatusPermitidos = this.pasosPreregistro
    .map(item => item.status)
    .filter((status): status is string => status !== null);

  const estatusFiltrados = paso?.status
    ? [paso.status]
    : estatusPermitidos;

  this.resultados = this.ordenarComoArbol(
    this.comercios.filter(comercio => {
      const status = this.normalizarTexto(
        comercio.statusOriginal
      );

      return estatusFiltrados.some(
        permitido => this.normalizarTexto(permitido) === status
      );
    })
  );

  this.paginaActual = 1;
  this.accionesAbiertas = null;
}

  private limpiarFiltrosNoAplicables(): void {
    (['entidad', 'sucursal', 'caja', 'nombre', 'rfc', 'correo'] as const).forEach(filtro => {
      if (!this.filtroVisible(filtro)) {
        this.filtros[filtro] = '';
      }
    });
  }

  private coincideFiltrosJerarquia(comercio: Comercio): boolean {
    return (['entidad', 'sucursal', 'caja'] as const).every(filtro => {
      const termino = this.filtros[filtro].trim();
      if (!termino || !this.filtroVisible(filtro)) return true;

      return this.valorJerarquia(comercio, filtro).includes(this.normalizarTexto(termino));
    });
  }

  private valorJerarquia(comercio: Comercio, filtro: FiltroJerarquia): string {
    const patrones: Record<FiltroJerarquia, RegExp> = {
      entidad: /entidad[-\s]*0?(\d+)/i,
      sucursal: /sucursal[-\s]*0?(\d+)/i,
      caja: /caja[-\s]*0?(\d+)/i
    };
    const ruta = [comercio.idComercio, comercio.nodoId, comercio.jerarquia, comercio.nombreComercial]
      .filter(Boolean)
      .join(' / ');
    const numero = this.extraerNumero(ruta, patrones[filtro]);

    return this.normalizarTexto([numero || '', filtro, ruta].filter(Boolean).join(' '));
  }

  private normalizarComerciosApi(commerces: ConsultaComercioApi[]): Comercio[] {
    return commerces.map(comercio => ({
      ref: comercio.ref,
      idComercio: comercio.displayId || 'ND',
      nivel: comercio.nivel as Comercio['nivel'],
      jerarquia: comercio.jerarquia || '',
      nombreComercial: comercio.nameCommerce || 'ND',
      razonSocial: comercio.businessName || 'ND',
      rfc: comercio.rfc || 'ND', correo: comercio.email || 'ND',
      telefono: comercio.phoneNumber || 'ND',
      estatus: this.estatusDesdeComercioApi(comercio),
      statusOriginal: String(comercio.status ?? ''),
      tieneInferiores: comercio.nivel !== 'Caja'
    }));
  }

 private estatusDesdeComercioApi(
  comercio: ConsultaComercioApi
): EstatusComercio {

  const status = this.normalizarTexto(
    String(
      comercio.status ??
      comercio['Status'] ??
      comercio['STATUS'] ??
      ''
    )
  );

  const etiquetas: Record<string, string> = {
    'PROSPECTO_ADMIN': 'Prospecto',
    '30': 'EN REVISIÓN DOCUMENTACIÓN',
    '31': 'PENDIENTE CUENTAS LIQUIDACIÓN'
  };

  if (etiquetas[status]) {
    return etiquetas[status];
  }

  if (this.esPendienteRevision(status)) {
    return 'Pendiente de revisión';
  }

  if (this.esPendienteAutorizacionCore(status)) {
    return 'PENDIENTE AUTORIZACIÓN CORE';
  }

  if (status === 'ACTIVO' || status === 'ACTIVE') {
    return 'Activo';
  }

  if (status === 'INACTIVO' || status === 'INACTIVE') {
    return 'Inactivo';
  }

  if (
    status === 'BAJA' ||
    status === 'BAJA DEFINITIVA' ||
    status === 'BAJA_DEFINITIVA'
  ) {
    return 'Baja definitiva';
  }

  if (this.esProspectoCliente(comercio)) {
    return 'Prospecto';
  }

  return status || 'Sin estatus';
}

  private nivelDesdeComercioApi(comercio: ConsultaComercioApi): Comercio['nivel'] {
    const nivelServicio = this.nivelDesdeAffilationLevel(comercio.idAffilationLevel ?? comercio['idAffiliationLevel']);
    if (nivelServicio) return nivelServicio;

    if (this.esProspectoCliente(comercio)) return 'Prospecto';

    if (Number(comercio.terminalUserID) > 0) return 'Caja';
    if (Number(comercio.terminalID) > 0) return 'Sucursal';
    if (Number(comercio.entityID) > 0) return 'Entidad';
    return 'Sub Afiliado';
  }

  private nivelDesdeAffilationLevel(nivel: unknown): Comercio['nivel'] | null {
    const normalizado = this.normalizarTexto(String(nivel ?? ''));
    const niveles: Record<string, Comercio['nivel']> = {
      '3': 'Sub Afiliado',
      '4': 'Entidad',
      '5': 'Sucursal',
      '6': 'Caja',
    };
    if (niveles[normalizado]) return niveles[normalizado];

    if (normalizado === 'SUBAFILIADO' || normalizado === 'SUB_AFILIADO' || normalizado === 'SUB AFILIADO') {
      return 'Sub Afiliado';
    }

    if (normalizado === 'ENTIDAD') return 'Entidad';
    if (normalizado === 'SUCURSAL') return 'Sucursal';
    if (normalizado === 'TERMINAL' || normalizado === 'TERMINALES' || normalizado === 'CAJA') return 'Caja';
    if (normalizado === 'REFERENCIADOR' || normalizado === 'PROSPECTO' || normalizado === 'PROSPECTOS') return 'Prospecto';

    return null;
  }

  private esProspectoCliente(comercio: ConsultaComercioApi): boolean {
    const status = this.normalizarTexto(String(comercio.status ?? comercio['Status'] ?? comercio['STATUS'] ?? ''));

    return status === 'PROSPECTO_CLIENTE' || status === 'PROSPECTO_A_CLIENTE' || status === 'PROSPECTO_ADMIN';
  }

  private esProspectoAdmin(comercio: Comercio): boolean {
    return this.normalizarTexto(comercio.statusOriginal || '') === 'PROSPECTO_ADMIN';
  }

  private normalizarTexto(valor?: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private jerarquiaDesdeComercioApi(comercio: ConsultaComercioApi, nivel: Comercio['nivel']): string {
    const entidad = comercio.entityID ? `Entidad ${comercio.entityID}` : '';
    const sucursal = comercio.terminalID ? `Sucursal ${comercio.terminalID}` : '';
    const caja = comercio.terminalUserID ? `Caja ${comercio.terminalUserID}` : '';
    const subAfiliado = comercio.contextID ? `Sub ${comercio.contextID}` : '';

    const partes = nivel === 'Caja'
      ? [sucursal, caja]
      : nivel === 'Sucursal'
        ? [entidad, sucursal]
        : nivel === 'Entidad'
          ? [entidad]
          : [subAfiliado || entidad];

    const partesVisibles = partes.filter(Boolean);
    return partesVisibles.length ? partesVisibles.join(' / ') : nivel;
  }

  private idComercioDesdeApi(comercio: ConsultaComercioApi): string {
    return [
      comercio.contextID,
      comercio.entityID,
      comercio.terminalID,
      comercio.terminalUserID,
    ].filter(valor => Number(valor) > 0).join('-') || 'ND';
  }

  private guidDesdeComercioApi(comercio: ConsultaComercioApi): string {
    return String(
      comercio.commerceID
      || comercio.guid
      || comercio.validate
      || comercio['Guid']
      || comercio['GUID']
      || comercio['userGuid']
      || comercio['terminalGuid']
      || ''
    );
  }

  private pldIdDesdeComercioApi(comercio: ConsultaComercioApi): string {
    return String(
      comercio.pldID
      || comercio.pldId
      || comercio.PLDID
      || comercio['pld_id']
      || comercio['transactionId']
      || ''
    );
  }

  private nodeIdDesdeComercioApi(comercio: ConsultaComercioApi): string {
    return String(
      comercio.nodeID
      || comercio['nodeId']
      || comercio['idNode']
      || comercio['id_node']
      || ''
    );
  }

  private ordenarComoArbol(comercios: Comercio[]): Comercio[] {
    const nivelOrden: Record<Comercio['nivel'], number> = {
      'Sub Afiliado': 0,
      'Entidad': 1,
      'Sucursal': 2,
      'Caja': 3,
      'Prospecto': 4
    };

    return [...comercios].sort((a, b) => {
      const nivelDiff = nivelOrden[a.nivel] - nivelOrden[b.nivel];
      if (nivelDiff !== 0) return nivelDiff;

      const rutaA = this.rutaOrden(a);
      const rutaB = this.rutaOrden(b);
      for (let i = 0; i < Math.max(rutaA.length, rutaB.length); i += 1) {
        const diff = (rutaA[i] ?? -1) - (rutaB[i] ?? -1);
        if (diff !== 0) return diff;
      }

      return a.nombreComercial.localeCompare(b.nombreComercial);
    });
  }

  private rutaOrden(comercio: Comercio): number[] {
    const ruta = [comercio.nodoId, comercio.jerarquia, comercio.nombreComercial].filter(Boolean).join(' / ');
    const entidad = this.extraerNumero(ruta, /entidad[-\s]*0?(\d+)/i);
    const sucursal = this.extraerNumero(ruta, /sucursal[-\s]*0?(\d+)/i);
    const caja = this.extraerNumero(ruta, /caja[-\s]*0?(\d+)/i);

    if (comercio.nivel === 'Sub Afiliado') return [0, 0, 0];
    if (comercio.nivel === 'Entidad') return [entidad || this.extraerNumero(comercio.nombreComercial, /(\d+)/), 0, 0];
    if (comercio.nivel === 'Sucursal') return [entidad || 1, sucursal || this.extraerNumero(comercio.nombreComercial, /(\d+)/), 0];
    return [entidad || 1, sucursal || 1, caja || this.extraerNumero(comercio.nombreComercial, /(\d+)/)];
  }

  private extraerNumero(valor: string, patron: RegExp): number {
    const match = valor.match(patron);
    return match ? Number(match[1]) : 0;
  }

  cambiarPagina(pagina: number | string): void {
    const paginaSolicitada = Number(pagina);

    if (!Number.isFinite(paginaSolicitada)) {
      return;
    }

    const nuevaPagina = Math.min(Math.max(paginaSolicitada, 1), this.totalPaginas);

    if (nuevaPagina === this.paginaActual) {
      return;
    }

    this.paginaActual = nuevaPagina;
    this.accionesAbiertas = null;
  }

  seleccionarPagina(pagina: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.cambiarPagina(pagina);
    (event.currentTarget as HTMLButtonElement | null)?.blur();
  }

  toggleAcciones(idComercio: string): void {
    this.accionesAbiertas = this.accionesAbiertas === idComercio ? null : idComercio;
  }

  idAcciones(comercio: Comercio, indice: number): string {
    if (comercio.ref) return comercio.ref;
    return [
      comercio.idComercio,
      comercio.nodoId,
      comercio.guid,
      comercio.nivel,
      indice,
    ].filter(Boolean).join('|');
  }

  ejecutarAccion(accion: 'editarInformacion' | 'inactivar' | 'baja' | 'password', comercio: Comercio): void {
    if (!this.accionesInternasHabilitadas && accion === 'password') return;
    this.accionesAbiertas = null;

    if (accion === 'editarInformacion') {
      if (!this.puedeEditarInformacion || !comercio.ref) return;
      this.router.navigate(['/registro_cliente'], { queryParams: { ref: comercio.ref } });
      return;
    }

    if (accion === 'password') {
      if (!this.puedeConsultarPassword(comercio)) return;
      this.modalPassword = comercio;
      this.mostrarPassword = false;
      this.consultarPasswordCaja(comercio);
      return;
    }

    if (accion === 'inactivar' && !this.puedeInactivar(comercio)) return;
    if (accion === 'baja' && !this.puedeDarBaja()) return;

    this.modalConfirmacion = { tipo: accion, comercio };
  }

  confirmarOperacion(): void {
    if (!this.modalConfirmacion) return;
    if (this.modalConfirmacion.tipo === 'baja' ? !this.puedeDarBaja() : !this.puedeInactivar(this.modalConfirmacion.comercio)) return;

    const { tipo, comercio } = this.modalConfirmacion;
    comercio.estatus = tipo === 'inactivar' ? 'Inactivo' : 'Baja definitiva';
    this.modalConfirmacion = null;
  }

  abrirCambioPassword(): void {
    if (!this.accionesInternasHabilitadas) return;
    if (!this.modalPassword) return;

    this.modalCambiarPassword = this.modalPassword;
    this.modalPassword = null;
    this.nuevaPassword = '';
    this.confirmarPassword = '';
    this.errorPassword = '';
    this.mensajePassword = '';
    this.mostrarNuevaPassword = false;
    this.mostrarConfirmarPassword = false;
  }

  private consultarPasswordCaja(comercio: Comercio): void {
    if (!this.accionesInternasHabilitadas) return;
    if (!comercio.guid) {
      this.errorPassword = 'La caja no tiene guid para consultar la contraseña.';
      return;
    }

    this.cargandoPassword = true;
    this.errorPassword = '';
    comercio.password = '';

    this.consultaComerciosService.consultarPasswordCaja(comercio.guid).subscribe({
      next: respuesta => {
        const password = this.passwordDesdeRespuesta(respuesta);
        if (!password) {
          this.errorPassword = respuesta.error?.message || respuesta.message || 'No se encontro contraseña para esta caja.';
        }

        comercio.password = password;
        this.cargandoPassword = false;
      },
      error: () => {
        this.errorPassword = 'No fue posible consultar la contraseña.';
        comercio.password = '';
        this.cargandoPassword = false;
      }
    });
  }

  private passwordDesdeRespuesta(respuesta: unknown): string {
    return this.buscarValorEnRespuesta(respuesta, ['tuPassword', 'password', 'pwd']);
  }

  private buscarValorEnRespuesta(respuesta: unknown, llaves: string[]): string {
    if (!respuesta) return '';
    if (typeof respuesta === 'string') return respuesta;
    if (typeof respuesta !== 'object') return '';

    if (Array.isArray(respuesta)) {
      for (const item of respuesta) {
        const valor = this.buscarValorEnRespuesta(item, llaves);
        if (valor) return valor;
      }
      return '';
    }

    const data = respuesta as Record<string, unknown>;
    for (const llave of llaves) {
      const valor = data[llave];
      if (typeof valor === 'string') return valor;
    }

    for (const valor of Object.values(data)) {
      const encontrado = this.buscarValorEnRespuesta(valor, llaves);
      if (encontrado) return encontrado;
    }

    return '';
  }

  guardarPassword(): void {
    if (!this.accionesInternasHabilitadas) return;
    if (!this.modalCambiarPassword || !this.passwordValida || this.nuevaPassword !== this.confirmarPassword) return;
    if (!this.modalCambiarPassword.guid) {
      this.errorPassword = 'La caja no tiene guid para cambiar la contraseña.';
      return;
    }

    this.guardandoPassword = true;
    this.errorPassword = '';
    this.mensajePassword = '';

    this.recuperarCuentaService.recuperarCuenta({
      guid: this.modalCambiarPassword.guid,
      nueva: this.nuevaPassword
    }).subscribe({
      next: respuesta => {
        if (respuesta?.success === false) {
          this.errorPassword = respuesta.error?.message || 'No fue posible cambiar la contraseña.';
          this.guardandoPassword = false;
          return;
        }

        this.modalCambiarPassword!.password = this.nuevaPassword;
        this.mensajePassword = 'Contraseña actualizada correctamente.';
        this.guardandoPassword = false;
        this.modalCambiarPassword = null;
      },
      error: () => {
        this.errorPassword = 'No fue posible cambiar la contraseña.';
        this.guardandoPassword = false;
      }
    });
  }

  private nodoRegistroPorComercio(comercio: Comercio): string {
    if (comercio.nodoId) return comercio.nodoId;
    if (comercio.nivel === 'Sub Afiliado') return 'sub-afiliado-1';
    if (comercio.nivel === 'Prospecto') return 'prospecto-1';

    const entidadMatch = comercio.jerarquia.match(/Entidad[-\s]+0?(\d+)/i);
    const sucursalMatch = comercio.jerarquia.match(/Sucursal[-\s]+0?(\d+)/i);
    const cajaMatch = comercio.jerarquia.match(/Caja[-\s]+0?(\d+)/i);
    const entidad = entidadMatch ? Number(entidadMatch[1]) : 1;

    if (comercio.nivel === 'Entidad') return `entidad-${entidad}`;

    const sucursal = sucursalMatch ? Number(sucursalMatch[1]) : 1;
    if (comercio.nivel === 'Sucursal') return `entidad-${entidad}-sucursal-${sucursal}`;

    const caja = cajaMatch ? Number(cajaMatch[1]) : 1;
    return `entidad-${entidad}-sucursal-${sucursal}-caja-${caja}`;
  }

  get passwordValida(): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$@!%*?&]).{12,}$/.test(this.nuevaPassword);
  }

  tieneAccionesDisponibles(comercio: Comercio): boolean {
    return (this.puedeEditarInformacion && !!comercio.ref)
      || this.puedeInactivar(comercio)
      || this.puedeDarBaja()
      || this.puedeConsultarPassword(comercio);
  }

  puedeInactivar(comercio: Comercio): boolean {
    const idRolSesion = this.obtenerIdRolSesion();
    const idRolComercio = this.idRolPorNivel(comercio.nivel);

    return [2, 3, 4, 5].includes(idRolSesion) && !!idRolComercio && idRolComercio > idRolSesion;
  }

  puedeDarBaja(): boolean {
    return this.obtenerIdRolSesion() === 2;
  }

  puedeConsultarPassword(comercio: Comercio): boolean {
    return this.accionesInternasHabilitadas && [2, 3, 4, 5].includes(this.obtenerIdRolSesion()) && comercio.nivel === 'Caja';
  }

  etiquetaInformacion(comercio: Comercio): string {
    return this.esAdministradorSesion() ? 'Editar Comercio' : 'Consultar Comercio';
  }

 get puedeEditarInformacion(): boolean {
  return this.obtenerIdRolSesion() === 2;
}
  private esAdministradorSesion(): boolean {
    return this.obtenerIdRolSesion() === 2;
  }

  puedeEditar(comercio: Comercio): boolean {
    return comercio.estatus === 'Prospecto' || this.esPendienteRevision(comercio.statusOriginal)
      || this.esPendienteAutorizacionCore(comercio.statusOriginal);
  }

  private obtenerIdRolSesion(): number {
    return this.auth.hasValidSession() ? Number(this.auth.getUserData()?.idRol ?? 0) : 0;
  }

  private idRolPorNivel(nivel: Comercio['nivel']): number {
    const niveles: Record<Comercio['nivel'], number> = {
      'Sub Afiliado': 3,
      'Entidad': 4,
      'Sucursal': 5,
      'Caja': 6,
      'Prospecto': 0
    };

    return niveles[nivel] ?? 0;
  }

  private numeroComercio(valor: unknown): number | undefined {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }

  exportarExcel(): void {
    const fecha = this.obtenerFechaArchivo();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`Consulta-Comercios-${fecha}`],
      this.encabezadosExportacion(),
      ...this.filasExportacion()
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    worksheet['!cols'] = this.encabezadosExportacion().map(() => ({ wch: 24 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consulta Comercios');
    XLSX.writeFile(workbook, `Consulta-Comercios-${fecha}.xlsx`);
    this.exportMenuAbierto = false;
  }

  exportarPDF(): void {
    const fecha = this.obtenerFechaArchivo();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text(`Consulta de Comercios - ${fecha}`, 148, 20, { align: 'center' });

    autoTable(doc, {
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [199, 146, 75], textColor: [20, 20, 20], fontStyle: 'bold' },
      head: [this.encabezadosExportacion()],
      body: this.filasExportacion()
    });

    doc.save(`Consulta-Comercios-${fecha}.pdf`);
    this.exportMenuAbierto = false;
  }

  normalizarNivel(nivel: Comercio['nivel']): NivelComercio {
    return nivel.toLowerCase().replace(' ', '-') as NivelComercio;
  }

  private encabezadosExportacion(): string[] {
    return ['Id Comercio', 'Nivel', 'Nombre Comercial', 'Razón Social', 'RFC', 'Correo Electrónico', 'Teléfono', 'Estatus'];
  }

  private filasExportacion(): string[][] {
    return this.resultadosFiltradosTabla.map(comercio => [
      comercio.idComercio,
      comercio.nivel,
      comercio.nombreComercial,
      comercio.razonSocial,
      comercio.rfc,
      comercio.correo,
      comercio.telefono,
      comercio.estatus
    ]);
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
