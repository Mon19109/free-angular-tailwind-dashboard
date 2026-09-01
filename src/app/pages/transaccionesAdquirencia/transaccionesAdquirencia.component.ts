import { Component, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransaccionesAdquirenciaService, FiltrosTransaccion, Transaccion, TicketResponse } from '../../services/transaccionesadquirencia.service';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
//import { AuthService, UserSessionData } from '../../services/auth.service';
//import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';

declare var bootbox: any;
declare var moment: any;

@Component({
  selector: 'app-transacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './transaccionesAdquirencia.component.html',
  styleUrls: ['./transaccionesAdquirencia.component.css']
})
export class TransaccionesAdquirenciaComponent implements OnInit, AfterViewInit {
  private transaccionesAdquirenciaService = inject(TransaccionesAdquirenciaService);
  
  // Variables de sesión (deben venir de AuthService)
  rolId = '2';
  contId = '1';
  entiId = '1';
  subAfSelect = '0';
  entidadSelect = '0';
  sucursalSelect = '0';
  cajaSelect = '0';
  baseUrl = '';
  urlTi = '';
  keyMaps = '';
  
  // Signals
  subafiliados = signal<any[]>([]);
  entidades = signal<any[]>([]);
  sucursales = signal<any[]>([]);
  cajas = signal<any[]>([]);
  operaciones = signal<any[]>([]);
  estadosTransaccion = signal<any[]>([]);
  transacciones = signal<Transaccion[]>([]);
  
  loading = signal<boolean>(false);
  showTable = signal<boolean>(false);
  errorMessage = signal<string>('');
  subafiliadoSesionBloqueado = false;
  entidadSesionBloqueada = false;
  sucursalSesionBloqueada = false;
  cajaSesionBloqueada = false;
  // Filtros
  filtros: FiltrosTransaccion = {
    subafiliado: '',
    entidad: '',
    sucursal: '',
    caja: '',
    operacion: '',
    monto: '',
    montoDesde: '',
    montoHasta: '',
    edoTransaccion: '',
    referencia: '',
    autorizacion: '',
    numTarjeta: '',
    bin: '',
    fechaInicio: '',
    fechaFin: ''
  };
  
  //user: UserSessionData | null = null;
  elementosPorPagina = 10;
  paginaActual = 1;
  busquedaTabla = '';
  exportMenuAbierto = false;
  
  @ViewChild('map') mapElement!: ElementRef;
  @ViewChild('alertaMensaje') alertaMensaje?: ElementRef<HTMLElement>;
  @ViewChild('zonaMensajes') zonaMensajes?: ElementRef<HTMLElement>;
  
  ngOnInit() {
    this.cargarDatosSesion();
    this.inicializarFechas();
    this.cargarCatalogos();
    this.cargarDependenciasIniciales();

  }
  
  ngAfterViewInit() {
  }

  private cargarDatosSesion() {
    this.rolId = localStorage.getItem('idRol') || this.rolId;
    this.contId = localStorage.getItem('idContext') || this.contId;
    this.entiId = localStorage.getItem('idEntity') || this.entiId;
  }

  onFechaInicioChange(event: any) {
    this.filtros.fechaInicio = event.dateStr;
  }

  onFechaFinChange(event: any) {
    this.filtros.fechaFin = event.dateStr;
  }
  
  inicializarFechas() {
    const hoy = new Date();
    const mesLim = new Date();
    mesLim.setDate(mesLim.getDate() - 30);
    
    // Si no hay fechas seleccionadas, establecer fecha fin a hoy y fecha inicio a hace 30 días
    if (!this.filtros.fechaInicio) {
      this.filtros.fechaInicio = mesLim.toISOString().slice(0, 16);
    }
    if (!this.filtros.fechaFin) {
      this.filtros.fechaFin = hoy.toISOString().slice(0, 16);
    }
  }
  
  cargarCatalogos() {

  this.transaccionesAdquirenciaService.getOperaciones().subscribe({
    next: (res) => {
      console.log('OPERACIONES', res);

      this.operaciones.set(
        res.catTransactionTypes || []
      );
    },
    error: (err) => console.error(err)
  });

  this.transaccionesAdquirenciaService.getEstadosTransaccion().subscribe({
    next: (res) => {
      console.log('[Transacciones Adquirencia] catResponseCode/getAll:', res);

      this.estadosTransaccion.set(
        res.catResponseCodes || []
      );
    },
    error: (err) => console.error(err)
  });

}

  get nivelUsuario(): 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' {
    if (this.rolId === '3') return 'entidad';
    if (this.rolId === '4') return 'sucursal';
    if (this.rolId === '5' || this.rolId === '6') return 'caja';
    return 'sub-afiliado';
  }

  get mostrarFiltroEntidad(): boolean { return this.nivelUsuario === 'sub-afiliado'; }
  get mostrarFiltroSucursal(): boolean { return this.nivelUsuario === 'sub-afiliado' || this.nivelUsuario === 'entidad'; }
  get mostrarFiltroCaja(): boolean { return this.nivelUsuario !== 'caja'; }
  get resumenTransacciones() {
    const montos = this.transacciones().map(item => this.toNumber(item.amount));
    const total = montos.reduce((acc, monto) => acc + monto, 0);
    const transaccionMasAlta = montos.length ? Math.max(...montos) : 0;

    return {
      totalTransacciones: this.transacciones().length,
      montoTotal: total,
      promedio: montos.length ? total / montos.length : 0,
      transaccionMasAlta
    };
  }

  get transaccionesFiltradasTabla(): Transaccion[] {
    const termino = this.busquedaTabla.trim().toLowerCase();
    if (!termino) return this.transacciones();

    return this.transacciones().filter(transaccion =>
      [
        transaccion.idOperation,
        transaccion.authorizationDate,
        transaccion.entityName,
        transaccion.terminalName,
        transaccion.terminalUserName,
        transaccion.transactiontype,
        transaccion.status,
        transaccion.payEmail || transaccion.terminalUserName,
        transaccion.amount
      ].some(valor => String(valor ?? '').toLowerCase().includes(termino))
    );
  }

  get transaccionesPaginadas(): Transaccion[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.transaccionesFiltradasTabla.slice(inicio, inicio + this.elementosPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.transaccionesFiltradasTabla.length / this.elementosPorPagina));
  }

  get paginas(): Array<number | string> {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginasVisibles = new Set<number>([1, total]);

    for (let pagina = actual - 2; pagina <= actual + 2; pagina++) {
      if (pagina > 1 && pagina < total) {
        paginasVisibles.add(pagina);
      }
    }

    const paginasOrdenadas = Array.from(paginasVisibles).sort((a, b) => a - b);
    return paginasOrdenadas.reduce<Array<number | string>>((paginas, pagina, index) => {
      const paginaAnterior = paginasOrdenadas[index - 1];
      if (index > 0 && pagina - paginaAnterior > 1) {
        paginas.push('...');
      }
      paginas.push(pagina);
      return paginas;
    }, []);
  }
  
  cargarDependenciasIniciales() {
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    this.cargarSubafiliados();

    if (!nodeIDSesion) return;

    this.cargarEntidades(nodeIDSesion);
    this.cargarSucursales(nodeIDSesion);
    this.cargarCajas(nodeIDSesion);
  }
  
  onSubafiliadoChange() {
    this.cargarEntidades(this.getSelectedNodeID(this.filtros.subafiliado));
  }

  cargarSubafiliados() {
    const idContextSesion = localStorage.getItem('idContext') || this.contId;

    if (this.rolId !== '2' || (idContextSesion && idContextSesion !== '0')) {
      this.cargarSubafiliadoSesion();
      return;
    }

    this.transaccionesAdquirenciaService.getSubafiliados().subscribe({
      next: (res) => {
        if (res.contextResponse) {
          const subafiliadoList = res.contextResponse || res.contextResponse;
          this.subafiliados.set(subafiliadoList);
        } else {
          /*bootbox.alert({
            message: "El subafiliado.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        this.cargarSubafiliadoSesion();
        /*bootbox.alert({
          message: "Error al cargar entidades.",
          locale: 'mx'
        });*/
      }
    });
  }

  private cargarSubafiliadoSesion() {
    const nodeID = localStorage.getItem('nodeID');
    if (!nodeID) {
      this.subafiliados.set([]);
      return;
    }

    this.transaccionesAdquirenciaService.getSubafiliadoById().subscribe({
      next: (res) => {
        const contextResponse = res.contextResponse
          ?? res.rows?.contextResponse
          ?? res.rows
          ?? res.data
          ?? res;
        const subafiliadoList = Array.isArray(contextResponse)
          ? contextResponse
          : contextResponse
            ? [contextResponse]
            : [];

        this.subafiliados.set(subafiliadoList);
        this.seleccionarSubafiliadoSesion(subafiliadoList);

      },
      error: (err) => {
        this.seleccionarSubafiliadoSesion([]);
        console.error('Error al cargar subafiliado por sesión:', err);
      }
    });
  }
  
  cargarEntidades(nodeID: string) {
    this.transaccionesAdquirenciaService.getEntidades(nodeID).subscribe({
      next: (res) => {
        const entidadesResponse = res
          ?? res.rows
          ?? res.rows
          ?? res.data
          ?? res;
        const entidadesList = Array.isArray(entidadesResponse)
          ? entidadesResponse
          : entidadesResponse
            ? [entidadesResponse]
            : [];
        if (Array.isArray(entidadesList) && entidadesList.length > 0) {
          this.entidades.set(entidadesList);
          this.seleccionarEntidadSesion(entidadesList);
        } else {
          this.seleccionarEntidadSesion([]);
          /*bootbox.alert({
            message: "El subafiliado seleccionado no tiene entidades relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        this.seleccionarEntidadSesion([]);
        /*bootbox.alert({
          message: "Error al cargar entidades.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  onEntidadChange() {
    this.cargarSucursales(this.getSelectedNodeID(this.filtros.entidad));
  }
  
  cargarSucursales(nodeID: string) {
    this.transaccionesAdquirenciaService.getSucursales(nodeID).subscribe({
      next: (res) => {
        const sucursalesList = res || res.rows || res.rows || [];
        if (Array.isArray(sucursalesList) && sucursalesList.length > 0) {
          this.sucursales.set(sucursalesList);
          this.seleccionarSucursalSesion(sucursalesList);
        } else {
          this.seleccionarSucursalSesion([]);
          /*bootbox.alert({
            message: "La entidad seleccionada no tiene sucursales relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        this.seleccionarSucursalSesion([]);
        /*bootbox.alert({
          message: "Error al cargar sucursales.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  onSucursalChange() {
    this.cargarCajas(this.getSelectedNodeID(this.filtros.sucursal));
  }
  
  cargarCajas(nodeID: string) {
    this.transaccionesAdquirenciaService.getCajas(nodeID).subscribe({
      next: (res) => {
        const cajasResponse = res
          ?? res.rows
          ?? res.rows
          ?? res.data
          ?? res;
        const cajasList = Array.isArray(cajasResponse)
          ? cajasResponse
          : cajasResponse
            ? [cajasResponse]
            : [];
        if (Array.isArray(cajasList) && cajasList.length > 0) {
          this.cajas.set(cajasList);
          this.seleccionarCajaSesion(cajasList);
        } else {
          this.seleccionarCajaSesion([]);
          /*bootbox.alert({
            message: "La sucursal seleccionada no tiene cajas relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        this.seleccionarCajaSesion([]);
        /*bootbox.alert({
          message: "Error al cargar cajas.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  validarFechas(): boolean {
    if (!this.filtros.fechaInicio || !this.filtros.fechaFin) {
      this.errorMessage.set('Selecciona fecha inicio y fecha fin para buscar.');
      return false;
    }
    
    const fechaInicio = this.obtenerFechaFiltro(this.filtros.fechaInicio);
    const fechaFin = this.obtenerFechaFiltro(this.filtros.fechaFin);

    if (!fechaInicio || !fechaFin) {
      this.errorMessage.set('Selecciona fecha inicio y fecha fin para buscar.');
      return false;
    }

    if (fechaInicio.getTime() > Date.now() || fechaFin.getTime() > Date.now()) {
      this.errorMessage.set('No puedes seleccionar una fecha mayor a la fecha actual.');
      return false;
    }

    if (fechaFin.getTime() < fechaInicio.getTime()) {
      this.errorMessage.set('La fecha fin no puede ser anterior a la fecha inicio.');
      return false;
    }

    const diffDays = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      this.errorMessage.set('Para poder hacer una búsqueda necesitas seleccionar un rango de fecha no mayor a 30 días.');
      return false;
    }
    
    this.errorMessage.set('');
    return true;
  }

  private obtenerFechaFiltro(value: unknown): Date | null {
    const texto = String(value ?? '').trim();
    if (!texto) return null;

    const fecha = new Date(texto.replace(' ', 'T'));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  
  formatoMonto(value: string | number): string {
    if (!value) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }
  
  buscarTransacciones() {
    if (!this.validarFechas()) {
      return;
    }
    
    this.loading.set(true);
    this.showTable.set(false);
    
    this.transaccionesAdquirenciaService.buscarTransacciones(this.filtros).subscribe({
      next: (res) => {
        this.showTable.set(true);
        this.processTransactions(res);
        this.paginaActual = 1;
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error:', err);
        this.loading.set(false);
        /*bootbox.alert({
          message: 'Error al buscar transacciones',
          locale: 'mx'
        });*/
      }
    });
  }
  
  processTransactions(data: any) {
    const transacciones = this.aplicarFiltrosLocales(this.obtenerTransaccionesRespuesta(data));
    console.log('[Transacciones Adquirencia] searchOperations response:', data);
    console.log('[Transacciones Adquirencia] primeros estatus recibidos:', transacciones.slice(0, 10).map((transaccion: any) => ({
      idOperation: transaccion?.idOperation,
      status: transaccion?.status,
      statusDescription: transaccion?.statusDescription,
      responseCode: transaccion?.responseCode,
      responseCodeMaster: transaccion?.responseCodeMaster,
      responseDescription: transaccion?.responseDescription,
      respCodeDescription: transaccion?.respCodeDescription
    })));
    this.transacciones.set(transacciones);
  }

  private aplicarFiltrosLocales(transacciones: Transaccion[]): Transaccion[] {
    return transacciones.filter(transaccion =>
      this.coincideSeleccion(this.filtros.subafiliado, transaccion, this.subafiliados(), ['contextID', 'context', 'entityName'])
      && this.coincideSeleccion(this.filtros.entidad, transaccion, this.entidades(), ['entityName'])
      && this.coincideSeleccion(this.filtros.sucursal, transaccion, this.sucursales(), ['terminalID', 'terminalName'])
      && this.coincideSeleccion(this.filtros.caja, transaccion, this.cajas(), ['terminalUserName'])
      && this.coincideOperacion(transaccion)
      && this.coincideEstatus(transaccion)
      && this.coincideMonto(transaccion.amount)
      && this.coincideTexto(this.filtros.referencia, transaccion.authorizationRrcext, transaccion.referenceOne, transaccion.referenceTwo, transaccion.referenceThree, transaccion.paymentLink)
      && this.coincideTexto(this.filtros.autorizacion, transaccion.authorizationNumber)
      && this.coincideTexto(this.filtros.numTarjeta, transaccion.card)
      && this.coincideTexto(this.filtros.bin, transaccion.bin)
      && this.coincideTexto(this.filtros.email, transaccion.payEmail, transaccion.terminalUserName)
    );
  }

  private coincideSeleccion(filtro: string | undefined, transaccion: Transaccion, opciones: any[], campos: string[]): boolean {
    const valor = this.normalizarFiltro(filtro);
    if (!valor) return true;

    const opcion = opciones.find(item => this.normalizarFiltro(item.idNode ?? item.nodeID) === valor);
    const textos = [
      valor,
      opcion?.name,
      opcion?.contextDescription,
      opcion?.entityDescription,
      opcion?.businessName,
      opcion?.tuName,
      ...campos.map(campo => (transaccion as any)[campo])
    ].map(item => this.normalizarFiltro(item)).filter(Boolean);

    return textos.some(texto => texto === valor)
      || campos.some(campo => textos.some(texto => this.normalizarFiltro((transaccion as any)[campo]).includes(texto)));
  }

  private coincideOperacion(transaccion: Transaccion): boolean {
    const valor = this.normalizarFiltro(this.filtros.operacion);
    if (!valor) return true;

    const operacion = this.operaciones().find(item => this.normalizarFiltro(this.valorOperacion(item)) === valor);
    const tipoTransaccion = this.normalizarFiltro([transaccion.transactiontype, transaccion.entryMode].filter(Boolean).join(' '));
    const textosOperacion = [valor, operacion?.tTypeInternalkey, operacion?.description]
      .map(item => this.normalizarFiltro(item))
      .filter(Boolean);

    return textosOperacion.some(texto => tipoTransaccion.includes(texto) || texto.includes(tipoTransaccion));
  }

  private coincideEstatus(transaccion: Transaccion): boolean {
    const valor = this.normalizarFiltro(this.filtros.edoTransaccion);
    if (!valor) return true;

    const estatus = this.estadosTransaccion().find(item => this.normalizarFiltro(this.valorEstadoTransaccion(item)) === valor);
    const textoTransaccion = this.normalizarFiltro([transaccion.status, transaccion.responseDescription].filter(Boolean).join(' '));
    const textosEstatus = [valor, estatus?.respCodeDescription, estatus?.responseDescription]
      .map(item => this.normalizarFiltro(item))
      .filter(Boolean);

    return textosEstatus.some(texto => textoTransaccion.includes(texto) || texto.includes(textoTransaccion));
  }

  private coincideMonto(value: string | number): boolean {
    const monto = this.toNumber(this.filtros.monto || this.filtros.montoDesde || '');
    if (!monto) return true;
    return this.toNumber(value) === monto;
  }

  private coincideTexto(filtro: unknown, ...valores: unknown[]): boolean {
    const textoFiltro = this.normalizarFiltro(filtro);
    if (!textoFiltro) return true;
    return valores.some(valor => this.normalizarFiltro(valor).includes(textoFiltro));
  }

  private normalizarFiltro(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  valorOperacion(item: any): string {
    return String(
      item?.idTransactionType
      ?? item?.transactionType
      ?? item?.id
      ?? item?.code
      ?? item?.tTypeInternalkey
      ?? item?.description
      ?? ''
    );
  }

  textoOperacion(item: any): string {
    return String(item?.tTypeInternalkey ?? item?.description ?? item?.name ?? this.valorOperacion(item));
  }

  valorEstadoTransaccion(item: any): string {
    return String(
      item?.responseCode
      ?? item?.idResponseCode
      ?? item?.status
      ?? item?.idStatus
      ?? item?.code
      ?? ''
    );
  }

  textoEstadoTransaccion(item: any): string {
    return String(item?.respCodeDescription ?? item?.responseDescription ?? item?.statusDescription ?? item?.description ?? this.valorEstadoTransaccion(item));
  }

  private obtenerTransaccionesRespuesta(data: any): Transaccion[] {
    const posiblesListas = [
      data?.rows?.content,
      data?.content,
      data?.rows,
      data?.data?.rows?.content,
      data?.data?.content,
      data?.data?.rows,
      data?.data,
      data?.operationsResponse,
      data?.operations?.content,
      data?.operations,
      data?.result?.content,
      data?.result,
      data
    ];

    const lista = posiblesListas.find(Array.isArray);
    return (lista || []) as Transaccion[];
  }

  private getSelectedNodeID(value?: string): string {
    return value || localStorage.getItem('nodeID') || '';
  }

  private seleccionarSubafiliadoSesion(subafiliados: any[]): void {
    this.subafiliadoSesionBloqueado = false;

    if (this.rolId !== '3') return;

    this.filtros.subafiliado = '';
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeSubafiliadoSesion = subafiliados.some(
      subafiliado => String(subafiliado.idNode ?? subafiliado.nodeID ?? '') === nodeIDSesion
    );

    if (existeSubafiliadoSesion) {
      this.filtros.subafiliado = nodeIDSesion;
      this.subafiliadoSesionBloqueado = true;
    }
  }

  private seleccionarEntidadSesion(entidades: any[]): void {
    this.entidadSesionBloqueada = false;

    if (this.rolId !== '4') return;

    this.filtros.entidad = '';
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeEntidadSesion = entidades.some(
      entidad => String(entidad.idNode ?? entidad.nodeID ?? '') === nodeIDSesion
    );

    if (existeEntidadSesion) {
      this.filtros.entidad = nodeIDSesion;
      this.entidadSesionBloqueada = true;
    }
  }

  private seleccionarSucursalSesion(sucursales: any[]): void {
    this.sucursalSesionBloqueada = false;

    if (this.rolId !== '5') return;

    this.filtros.sucursal = '';
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeSucursalSesion = sucursales.some(
      sucursal => String(sucursal.idNode ?? sucursal.nodeID ?? '') === nodeIDSesion
    );

    if (existeSucursalSesion) {
      this.filtros.sucursal = nodeIDSesion;
      this.sucursalSesionBloqueada = true;
    }
  }

  private seleccionarCajaSesion(cajas: any[]): void {
    this.cajaSesionBloqueada = false;

    if (this.rolId !== '6') return;

    this.filtros.caja = '';
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeCajaSesion = cajas.some(
      caja => String(caja.idNode ?? caja.nodeID ?? '') === nodeIDSesion
    );

    if (existeCajaSesion) {
      this.filtros.caja = nodeIDSesion;
      this.cajaSesionBloqueada = true;
    }
  }
  
  limpiarFiltros() {
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    this.filtros = {
      subafiliado: this.subafiliadoSesionBloqueado ? nodeIDSesion : '',
      entidad: this.entidadSesionBloqueada ? nodeIDSesion : '',
      sucursal: this.sucursalSesionBloqueada ? nodeIDSesion : '',
      caja: this.cajaSesionBloqueada ? nodeIDSesion : '',
      operacion: '',
      monto: '',
      montoDesde: '',
      montoHasta: '',
      edoTransaccion: '',
      referencia: '',
      autorizacion: '',
      numTarjeta: '',
      bin: '',
      fechaInicio: '',
      fechaFin: ''
    };
    this.inicializarFechas();
    this.busquedaTabla = '';
    this.paginaActual = 1;
  }

  cambiarPagina(pagina: number): void {
    this.paginaActual = Math.min(Math.max(pagina, 1), this.totalPaginas);
  }

  cambiarPaginaPaginador(pagina: number | string): void {
    if (typeof pagina !== 'number') return;
    this.cambiarPagina(pagina);
  }

  formatCurrency(value: string | number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  formatearMontoFiltro(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');

    if (!digits) {
      this.filtros.monto = '';
      input.value = '';
      return;
    }

    const monto = Number(digits) / 100;
    const formatted = monto.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    this.filtros.monto = formatted;
    input.value = formatted;
  }

  tipoTransaccionClase(tipo?: string): string {
    const normalizado = this.normalizarTexto(tipo);
    if (normalizado.includes('venta')) return 'venta';
    if (normalizado.includes('pago')) return 'pago';
    if (normalizado.includes('devolucion')) return 'devolucion';
    if (normalizado.includes('transferencia')) return 'transferencia';
    return 'default';
  }

  tipoTransaccionIcono(tipo?: string): string {
    const clase = this.tipoTransaccionClase(tipo);
    const iconos: Record<string, string> = {
      venta: 'fa-cart-shopping',
      pago: 'fa-money-bill-wave',
      devolucion: 'fa-rotate-left',
      transferencia: 'fa-right-left',
      default: 'fa-receipt'
    };

    return iconos[clase];
  }

  esDevolucion(tipo?: string): boolean {
    return this.normalizarTexto(tipo).includes('devolucion');
  }

  exportarExcel(): void {
    const fecha = this.obtenerFechaArchivo();
    const rows = this.transaccionesFiltradasTabla.map(transaccion => this.exportRow(transaccion));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones Adquirencia');
    XLSX.writeFile(workbook, `Transacciones-Adquirencia-${fecha}.xlsx`);
    this.exportMenuAbierto = false;
  }

  exportarPDF(): void {
    const fecha = this.obtenerFechaArchivo();
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Transacciones-Adquirencia-${fecha}`, 148, 23, { align: 'center' });

    autoTable(doc, {
      startY: 30,
      styles: {
        fontSize: 7,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [44, 62, 80],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      bodyStyles: {
        textColor: [40, 40, 40]
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 34 },
        2: { cellWidth: 38 },
        3: { cellWidth: 38 },
        4: { cellWidth: 42 },
        5: { cellWidth: 24 },
        6: { cellWidth: 28 },
        7: { cellWidth: 48 }
      },
      head: [['ID', 'FECHA / HORA', 'SUCURSAL', 'CAJA', 'TIPO', 'MONTO', 'ESTATUS', 'USUARIO']],
      body: this.transaccionesFiltradasTabla.map(transaccion => [
        transaccion.idOperation,
        transaccion.authorizationDate,
        transaccion.terminalName,
        transaccion.terminalUserName,
        transaccion.transactiontype,
        this.formatCurrency(transaccion.amount),
        this.obtenerEstatusTransaccion(transaccion),
        transaccion.payEmail || transaccion.terminalUserName
      ])
    });
    doc.save(`Transacciones-Adquirencia-${fecha}.pdf`);
    this.exportMenuAbierto = false;
  }

  private exportRow(transaccion: Transaccion) {
    return {
      ID: transaccion.idOperation,
      'FECHA / HORA': transaccion.authorizationDate,
      SUCURSAL: transaccion.terminalName,
      CAJA: transaccion.terminalUserName,
      'TIPO TRANSACCION': transaccion.transactiontype,
      MONTO: this.formatCurrency(transaccion.amount),
      ESTATUS: this.obtenerEstatusTransaccion(transaccion),
      USUARIO: transaccion.payEmail || transaccion.terminalUserName
    };
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hour = String(fecha.getHours()).padStart(2, '0');
    const minute = String(fecha.getMinutes()).padStart(2, '0');
    const second = String(fecha.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}${minute}${second}`;
  }

  obtenerEstatusTransaccion(transaccion: any): string {
    return transaccion?.statusDescription
      || transaccion?.responseDescription
      || transaccion?.respCodeDescription
      || transaccion?.status
      || 'ND';
  }

  esEstatusAprobado(transaccion: any): boolean {
    return this.normalizarTexto(this.obtenerEstatusTransaccion(transaccion)).includes('aprob');
  }


  private toNumber(value: string | number): number {
    if (value === null || value === undefined || value === '') return 0;
    return typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, '')) || 0;
  }

  private normalizarTexto(value?: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  
  verTicket(transaccion: Transaccion) {
    if (this.normalizarTexto(transaccion.status) !== 'aprobada') {
      this.mostrarErrorTicket();
      return;
    }

    const ticketRequest = {
      terminalId: transaccion.terminalId ?? transaccion.idTerminal ?? localStorage.getItem('idTerminal') ?? '',
      rrcext: transaccion.rrcext ?? transaccion.authorizationRrcext ?? '',
      authorizationNumber: transaccion.authorizationNumber ?? '',
      authorizationId: transaccion.authorizationId ?? transaccion.idOperation ?? '',
      user: localStorage.getItem('mail') ?? '',
      context: transaccion.context ?? transaccion.idContext ?? localStorage.getItem('idContext') ?? ''
    };

    const ventanaTicket = window.open('', '_blank');

    if (!ventanaTicket) {
      this.errorMessage.set('El navegador bloqueó la ventana del ticket. Habilita las ventanas emergentes e inténtalo nuevamente.');
      return;
    }

    ventanaTicket.document.title = 'Ticket';
    ventanaTicket.document.body.textContent = 'Cargando ticket...';

    this.transaccionesAdquirenciaService.verTicket(ticketRequest).subscribe({
      next: (respuesta) => this.abrirRespuestaTicket(ventanaTicket, respuesta),
      error: (err) => {
        console.error('Error al consultar el ticket:', err);
        ventanaTicket.close();
        this.mostrarErrorTicket();
      }
    });
  }

  private mostrarErrorTicket(): void {
    this.errorMessage.set('No fue posible obtener el ticket');
    this.zonaMensajes?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private abrirRespuestaTicket(ventanaTicket: Window, respuesta: TicketResponse): void {
    if (respuesta?.voucher) {
      const voucherBase64 = this.convertirVoucherABase64(respuesta.voucher);
      const mimeType = respuesta.mimeType || respuesta.contentType || 'application/pdf';
      const urlVoucher = URL.createObjectURL(this.base64ABlob(voucherBase64, mimeType));
      ventanaTicket.location.href = urlVoucher;
      window.setTimeout(() => URL.revokeObjectURL(urlVoucher), 60_000);
      return;
    }

    const url = respuesta?.url || respuesta?.ticketUrl || respuesta?.voucherUrl || respuesta?.data?.url;
    if (url) {
      ventanaTicket.location.href = url;
      return;
    }

    ventanaTicket.close();
    this.mostrarErrorTicket();
  }

  private convertirVoucherABase64(voucher: unknown): string {
    if (typeof voucher === 'string') {
      const contenido = voucher.trim();
      const dataUrl = contenido.match(/^data:[^;]+;base64,(.+)$/i);
      if (dataUrl) return dataUrl[1];

      try {
        const contenidoDecodificado = atob(contenido);
        if (contenidoDecodificado.startsWith('%PDF')) return contenido;
      } catch {
        // El contenido todavía no está codificado en Base64.
      }

      return this.bytesABase64(new TextEncoder().encode(voucher));
    }

    if (voucher instanceof ArrayBuffer) {
      return this.bytesABase64(new Uint8Array(voucher));
    }

    if (Array.isArray(voucher)) {
      return this.bytesABase64(new Uint8Array(voucher));
    }

    if (voucher && typeof voucher === 'object' && Array.isArray((voucher as { data?: unknown }).data)) {
      return this.bytesABase64(new Uint8Array((voucher as { data: number[] }).data));
    }

    return this.bytesABase64(new TextEncoder().encode(JSON.stringify(voucher ?? '')));
  }

  private bytesABase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    let contenidoBinario = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
      contenidoBinario += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(contenidoBinario);
  }

  private base64ABlob(base64: string, mimeType: string): Blob {
    const contenidoBinario = atob(base64);
    const chunkSize = 0x8000;
    const partes: ArrayBuffer[] = [];

    for (let offset = 0; offset < contenidoBinario.length; offset += chunkSize) {
      const segmento = contenidoBinario.slice(offset, offset + chunkSize);
      const bytes = new Uint8Array(segmento.length);

      for (let index = 0; index < segmento.length; index++) {
        bytes[index] = segmento.charCodeAt(index);
      }

      partes.push(bytes.buffer);
    }

    return new Blob(partes, { type: mimeType });
  }
  
  mostrarModalDevolucion(transaccion: Transaccion) {
    const amountFormat = this.formatoMonto(transaccion.amount);
    const msg = this.generarHtmlDevolucion(transaccion, amountFormat);
    
    bootbox.dialog({
      title: "Ticket",
      message: msg,
      onEscape: true,
      backdrop: true,
      buttons: {
        confirm: {
          label: 'Imprimir',
          className: 'btn-primary',
          callback: () => this.imprimirTicket(msg)
        },
        cancel: {
          label: 'Ok',
          className: 'btn-success'
        }
      }
    });
  }
  
  generarHtmlDevolucion(transaccion: Transaccion, amountFormat: string): string {
    return `
      <div>
        <div style='font-family:Courier;'>
          <center>
            <br>
            <table border='0'>
              <tr>
                <td colspan='2' align='center' style='height:70px;background:#000; padding: 0px'>
                  <img src='https://portal-antares.kashplataforma.com/public/assets/img/logo_kashpay_sobra.png' height='50' align='center'>
                </td>
              </tr>
              <tr>
                <td colspan='2' align='center'>
                  <font style='font-size:9px;'>${transaccion.entityName} &nbsp;</font>
                </td>
              </tr>
              <tr style='font-size:9px;'>
                <td>FECHA:</td>
                <td align='right'>${transaccion.authorizationDate}</td>
              </tr>
              <tr><td>&nbsp;</td></tr>
              <tr><td>&nbsp;</td></tr>
            </table>
            <table width=248 border='0' cellspacing='0' cellpadding='0'>
              <tr style='font-size:11px;'>
                <td colspan='3' align='center' style='font-weight:bold'><center>DEVOLUCION</center></td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=2>NUMERO DE TARJETA/CTA</td>
                <td align='right' style='font-weight:bold'>XXXX-XXXX-XXXX-${transaccion.card}</td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=2 style='font-weight:bold'>IMPORTE</td>
                <td align='right'>${amountFormat}</td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=3 style='font-weight:bold'>APROBACION No :${transaccion.authorizationRrcext}</td>
              </tr>
            </table>
          </center>
        </div>
      </div>
    `;
  }
  
  mostrarTicketConMapa(transaccion: Transaccion) {
    const amountFormat = this.formatoMonto(transaccion.amount);
    const cordenadas = `${transaccion.latitude},${transaccion.longitude}`;
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${cordenadas}&zoom=15&size=600x300&maptype=roadmap&markers=color:red|${cordenadas}&key=${this.keyMaps}`;
    
    const msg = `
      <div>
        <div>
          <table border='0' style='width: 100%;'>
            <tr>
              <td colspan='3' align='center' style='height:70px;background:#333f50; padding: 0px'>
                <img src='https://kashplataforma.com.mx/adquirencia2/public/assets/img/logo_kashpay_azul.png' height='50' align='center'>
              </td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan='3' align='center' style='font-weight:bold'>${transaccion.entityName}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>FECHA:</td>
              <td style='font-weight:bold'>${transaccion.authorizationDate}</td>
            </tr>
            <tr style='font-size:14px;'>
              <td colspan='3' align='center' style='font-weight:bold'><center>VENTA</center></td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>NUMERO DE TARJETA/CTA</td>
              <td style='font-weight:bold'>${transaccion.card}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2 style='font-weight:bold'>IMPORTE</td>
              <td style='font-weight:bold'>${amountFormat}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2 >APROBACION</td>
              <td style='font-weight:bold'>${transaccion.authorizationNumber}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>FOLIO</td>
              <td style='font-weight:bold'>${transaccion.authorizationRrcext}</td>
            </tr>
            <tr>
              <td colspan=3>
                <img style='width:100%;' src='${imageUrl}'>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
    
    bootbox.dialog({
      title: "Ticket",
      message: msg,
      onEscape: true,
      backdrop: true,
      buttons: {
        confirm: {
          label: 'Imprimir',
          className: 'btn-primary',
          callback: () => this.imprimirTicket(msg)
        },
        cancel: {
          label: 'Ok',
          className: 'btn-success'
        }
      }
    });
  }
  
  imprimirTicket(html: string) {
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(html);
    printWindow?.document.write('</body></html>');
    printWindow?.print();
  }
  
  getComisiones(transaccion: Transaccion, tipo: number): number {
    const sirio = transaccion.operationSirio?.acquiringOperation;
    if (!sirio) return 0;
    
    switch(this.rolId) {
      case '2': return 0;
      case '3': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0);
      case '4': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0) + (sirio.transactionID || 0);
      case '5': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0) + (sirio.transactionID || 0) + (sirio.timestamp || 0);
      case '6': return sirio.settleAmount || 0;
      default: return 0;
    }
  }
  
  getIVA(transaccion: Transaccion): number {
    return transaccion.operationSirio?.acquiringOperation?.systemSource || 0;
  }
  
  puedeAclarar(transaccion: Transaccion): boolean {
    return transaccion.status === 'APROBADA' && 
           transaccion.transactiontype === 'VENTA' &&
           (this.rolId === '2' || this.rolId === '3' || this.contId === '83' || this.contId === '134' || this.entiId === 'SUB981645');
  }
  
  maskCard(card: string): string {
    if (!card) return '';
    const last4 = card.slice(-4);
    return `XXXX-XXXX-XXXX-${last4}`;
  }
}
