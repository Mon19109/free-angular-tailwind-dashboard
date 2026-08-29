import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConsultaComercioApi, ConsultaComerciosService } from '../../services/consulta-comercios.service';

type NivelComercio = 'todos' | 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' | 'prospectos';
type EstatusComercio = 'Activo' | 'Inactivo' | 'Baja definitiva' | 'Prospecto';
type PaginaVisible = { tipo: 'pagina'; valor: number } | { tipo: 'ellipsis'; valor: '...' };
type FiltroJerarquia = 'entidad' | 'sucursal' | 'caja';

interface Comercio {
  idComercio: string;
  nodoId?: string;
  guid?: string;
  nivel: 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja' | 'Prospecto';
  jerarquia: string;
  nombreComercial: string;
  razonSocial: string;
  rfc: string;
  correo: string;
  telefono: string;
  estatus: EstatusComercio;
  cajaPinRapido?: boolean;
  password?: string;
  tieneInferiores?: boolean;
  cuentaLiquidacion?: boolean;
  pldID?: string;
}

@Component({
  selector: 'app-consulta-comercios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultaComercios.component.html',
  styleUrls: ['./consultaComercios.component.css']
})
export class ConsultaComerciosComponent {
  constructor(
    private router: Router,
    private consultaComerciosService: ConsultaComerciosService
  ) {
    this.buscar();
  }

  readonly niveles = [
    { id: 'todos' as NivelComercio, label: 'Todos los niveles', icon: 'fa-layer-group' },
    { id: 'sub-afiliado' as NivelComercio, label: 'Sub Afiliado', icon: 'fa-user-tie' },
    { id: 'entidad' as NivelComercio, label: 'Entidad', icon: 'fa-building' },
    { id: 'sucursal' as NivelComercio, label: 'Sucursal', icon: 'fa-store' },
    { id: 'caja' as NivelComercio, label: 'Caja', icon: 'fa-cash-register' },
    { id: 'prospectos' as NivelComercio, label: 'Prospectos', icon: 'fa-user-clock' }
  ];

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
  private readonly comercioProspecto: Comercio = {
    idComercio: 'PROS-000001',
    nodoId: 'prospecto-1',
    nivel: 'Prospecto',
    jerarquia: 'Prospecto',
    nombreComercial: 'Prospecto Comercio Demo',
    razonSocial: 'Prospecto Comercio Demo SA de CV',
    rfc: 'PCD260826AB1',
    correo: 'prospecto.demo@kashpay.mx',
    telefono: '5512345678',
    estatus: 'Prospecto',
    tieneInferiores: false,
  };

  resultados = [...this.comercios];
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
  errorPassword = '';
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

  seleccionarNivel(nivel: NivelComercio): void {
    this.filtros.nivel = nivel;
    this.limpiarFiltrosNoAplicables();
    this.buscar();
  }

  buscar(): void {
    this.cargando = true;
    this.errorConsulta = '';
    this.consultaComerciosService.buscarComercios({
      nameCommerce: this.filtros.nombre.trim(),
      rfc: this.filtros.rfc.trim(),
      email: this.filtros.correo.trim(),
    }).subscribe({
      next: respuesta => {
        if (respuesta.success === false) {
          this.errorConsulta = respuesta.error?.message || 'No fue posible consultar los comercios.';
          this.resultados = [];
          this.cargando = false;
          return;
        }

        this.comercios = this.ordenarComoArbol(this.comerciosConProspecto(
          this.normalizarComerciosApi(respuesta.commerces ?? [])
        ));
        this.aplicarFiltroNivel();
        this.cargando = false;
      },
      error: () => {
        this.errorConsulta = 'No fue posible consultar los comercios.';
        this.comercios = this.ordenarComoArbol(this.comerciosConProspecto([]));
        this.aplicarFiltroNivel();
        this.cargando = false;
      }
    });
  }

  limpiar(): void {
    this.filtros = { nivel: 'todos', entidad: '', sucursal: '', caja: '', nombre: '', rfc: '', correo: '' };
    this.busquedaTabla = '';
    this.buscar();
    this.paginaActual = 1;
  }

  filtroVisible(filtro: FiltroJerarquia | 'nombre' | 'rfc' | 'correo'): boolean {
    const visiblesPorNivel: Record<NivelComercio, Array<FiltroJerarquia | 'nombre' | 'rfc' | 'correo'>> = {
      todos: ['entidad', 'sucursal', 'caja', 'nombre', 'rfc', 'correo'],
      'sub-afiliado': ['entidad', 'sucursal', 'caja', 'nombre', 'rfc', 'correo'],
      entidad: ['sucursal', 'caja', 'nombre', 'rfc', 'correo'],
      sucursal: ['nombre', 'rfc', 'correo'],
      caja: [],
      prospectos: ['nombre', 'rfc', 'correo']
    };

    return visiblesPorNivel[this.filtros.nivel].includes(filtro);
  }

  private aplicarFiltroNivel(): void {
    const nivel = this.filtros.nivel;
    this.resultados = this.ordenarComoArbol(this.comercios.filter(comercio => {
      const coincideNivel = nivel === 'todos'
        || (nivel === 'prospectos' ? comercio.estatus === 'Prospecto' : this.normalizarNivel(comercio.nivel) === nivel);

      return coincideNivel && this.coincideFiltrosJerarquia(comercio);
    }));
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
    return commerces.map(comercio => {
      const nivel = this.nivelDesdeComercioApi(comercio);
      return {
        idComercio: comercio.entitySonID || this.idComercioDesdeApi(comercio),
        guid: this.guidDesdeComercioApi(comercio),
        nivel,
        jerarquia: this.jerarquiaDesdeComercioApi(comercio, nivel),
        nombreComercial: comercio.nameCommerce || 'ND',
        razonSocial: comercio.businessName || 'ND',
        rfc: comercio.rfc || 'ND',
        correo: comercio.email || 'ND',
        telefono: comercio.phoneNumber || 'ND',
        estatus: this.estatusDesdeComercioApi(comercio),
        cajaPinRapido: nivel === 'Caja' && comercio.idBusinessModel === 3,
        tieneInferiores: nivel !== 'Caja',
        pldID: this.pldIdDesdeComercioApi(comercio),
      };
    });
  }

  private comerciosConProspecto(comercios: Comercio[]): Comercio[] {
    const sinProspectoDemo = comercios.filter(comercio => comercio.idComercio !== this.comercioProspecto.idComercio);
    return [...sinProspectoDemo, this.comercioProspecto];
  }

  private estatusDesdeComercioApi(comercio: ConsultaComercioApi): EstatusComercio {
    const nombreComercio = this.normalizarTexto(comercio.nameCommerce || '');
    const razonSocial = this.normalizarTexto(comercio.businessName || '');

    if (nombreComercio === 'TIENDA DEL BARRIO' || razonSocial === 'TIENDA DEL BARRIO') {
      return 'Prospecto';
    }

    const status = this.normalizarTexto(comercio.status || String(comercio['Status'] || comercio['STATUS'] || ''));

    if (status === 'ACTIVO' || status === 'ACTIVE') return 'Activo';
    if (status === 'INACTIVO' || status === 'INACTIVE') return 'Inactivo';
    if (status === 'BAJA' || status === 'BAJA DEFINITIVA' || status === 'BAJA_DEFINITIVA') return 'Baja definitiva';
    if (status === 'PROSPECTO' || status === 'PROSPECTOS') return 'Prospecto';

    return this.nivelDesdeComercioApi(comercio) === 'Prospecto' ? 'Prospecto' : 'Activo';
  }

  private nivelDesdeComercioApi(comercio: ConsultaComercioApi): Comercio['nivel'] {
    const nivelServicio = this.nivelDesdeAffilationLevel(comercio.idAffilationLevel);
    if (nivelServicio) return nivelServicio;

    // Respaldo para registros viejos que todavia no manden idAffilationLevel.
    if (Number(comercio.terminalUserID) > 0) return 'Caja';
    if (Number(comercio.terminalID) > 0) return 'Sucursal';
    if (Number(comercio.entityID) > 0) return 'Entidad';
    return 'Sub Afiliado';
  }

  private nivelDesdeAffilationLevel(nivel?: string): Comercio['nivel'] | null {
    const normalizado = this.normalizarTexto(nivel);

    if (normalizado === 'SUBAFILIADO' || normalizado === 'SUB_AFILIADO' || normalizado === 'SUB AFILIADO') {
      return 'Sub Afiliado';
    }

    if (normalizado === 'ENTIDAD') return 'Entidad';
    if (normalizado === 'SUCURSAL') return 'Sucursal';
    if (normalizado === 'TERMINAL' || normalizado === 'CAJA') return 'Caja';
    if (normalizado === 'REFERENCIADOR' || normalizado === 'PROSPECTO' || normalizado === 'PROSPECTOS') return 'Prospecto';

    return null;
  }

  private normalizarTexto(valor?: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private jerarquiaDesdeComercioApi(comercio: ConsultaComercioApi, nivel: Comercio['nivel']): string {
    const partes = [
      comercio.contextID ? `Sub ${comercio.contextID}` : '',
      comercio.entityID ? `Entidad ${comercio.entityID}` : '',
      comercio.terminalID ? `Sucursal ${comercio.terminalID}` : '',
      comercio.terminalUserID ? `Caja ${comercio.terminalUserID}` : '',
    ].filter(Boolean);

    return partes.length ? partes.join(' / ') : nivel;
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

  private ordenarComoArbol(comercios: Comercio[]): Comercio[] {
    const nivelOrden: Record<Comercio['nivel'], number> = {
      'Sub Afiliado': 0,
      'Entidad': 1,
      'Sucursal': 2,
      'Caja': 3,
      'Prospecto': 4
    };

    return [...comercios].sort((a, b) => {
      const rutaA = this.rutaOrden(a);
      const rutaB = this.rutaOrden(b);
      for (let i = 0; i < Math.max(rutaA.length, rutaB.length); i += 1) {
        const diff = (rutaA[i] ?? -1) - (rutaB[i] ?? -1);
        if (diff !== 0) return diff;
      }

      const nivelDiff = nivelOrden[a.nivel] - nivelOrden[b.nivel];
      if (nivelDiff !== 0) return nivelDiff;
      return a.nombreComercial.localeCompare(b.nombreComercial);
    });
  }

  private rutaOrden(comercio: Comercio): number[] {
    const ruta = [comercio.nodoId, comercio.jerarquia, comercio.nombreComercial].filter(Boolean).join(' / ');
    const entidad = this.extraerNumero(ruta, /entidad[-\s]*0?(\d+)/i);
    const sucursal = this.extraerNumero(ruta, /sucursal[-\s]*0?(\d+)/i);
    const caja = this.extraerNumero(ruta, /caja[-\s]*0?(\d+)/i);

    if (comercio.nivel === 'Sub Afiliado') return [0, 0, 0];
    if (comercio.nivel === 'Prospecto') return [99, 99, 99];
    if (comercio.nivel === 'Entidad') return [entidad || this.extraerNumero(comercio.nombreComercial, /(\d+)/), 0, 0];
    if (comercio.nivel === 'Sucursal') return [entidad || 1, sucursal || this.extraerNumero(comercio.nombreComercial, /(\d+)/), 0];
    return [entidad || 1, sucursal || 1, caja || this.extraerNumero(comercio.nombreComercial, /(\d+)/)];
  }

  private extraerNumero(valor: string, patron: RegExp): number {
    const match = valor.match(patron);
    return match ? Number(match[1]) : 0;
  }

  cambiarPagina(pagina: number): void {
    this.paginaActual = Math.min(Math.max(pagina, 1), this.totalPaginas);
  }

  toggleAcciones(idComercio: string): void {
    this.accionesAbiertas = this.accionesAbiertas === idComercio ? null : idComercio;
  }

  idAcciones(comercio: Comercio, indice: number): string {
    return [
      comercio.idComercio,
      comercio.nodoId,
      comercio.guid,
      comercio.nivel,
      indice,
    ].filter(Boolean).join('|');
  }

  ejecutarAccion(accion: 'editar' | 'inactivar' | 'baja' | 'password', comercio: Comercio): void {
    this.accionesAbiertas = null;

    if (accion === 'editar') {
      if (!this.puedeEditar(comercio)) return;

      this.router.navigate(['/registro_cliente'], {
        queryParams: {
          id: comercio.idComercio,
          nivel: comercio.nivel,
          nombre: comercio.nombreComercial,
          rfc: comercio.rfc,
          correo: comercio.correo,
          telefono: comercio.telefono,
          pldID: comercio.pldID,
          paquete: 'empresa-holding',
          entidades: 2,
          sucursales: 3,
          cajas: 2,
          selectedNode: this.nodoRegistroPorComercio(comercio)
        }
      });
      return;
    }

    if (accion === 'password') {
      this.modalPassword = comercio;
      this.mostrarPassword = false;
      this.consultarPasswordCaja(comercio);
      return;
    }

    this.modalConfirmacion = { tipo: accion, comercio };
  }

  confirmarOperacion(): void {
    if (!this.modalConfirmacion) return;

    const { tipo, comercio } = this.modalConfirmacion;
    comercio.estatus = tipo === 'inactivar' ? 'Inactivo' : 'Baja definitiva';
    this.modalConfirmacion = null;
  }

  abrirCambioPassword(): void {
    if (!this.modalPassword) return;

    this.modalCambiarPassword = this.modalPassword;
    this.modalPassword = null;
    this.nuevaPassword = '';
    this.confirmarPassword = '';
    this.mostrarNuevaPassword = false;
    this.mostrarConfirmarPassword = false;
  }

  private consultarPasswordCaja(comercio: Comercio): void {
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
    if (!this.modalCambiarPassword || !this.passwordValida || this.nuevaPassword !== this.confirmarPassword) return;

    this.modalCambiarPassword.password = this.nuevaPassword;
    this.modalCambiarPassword = null;
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

  puedeConsultarPassword(comercio: Comercio): boolean {
    return comercio.nivel === 'Caja';
  }

  puedeEditar(comercio: Comercio): boolean {
    return comercio.estatus === 'Prospecto';
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
