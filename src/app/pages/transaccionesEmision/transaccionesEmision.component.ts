import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { FormularioData, TransaccionesEmisionService } from '../../services/transaccionesemision.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-operacionesEmi',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './transaccionesEmision.component.html',
  styleUrls: ['./transaccionesEmision.component.css']
})
export class TransaccionesEmisionComponent implements OnInit {
  private readonly transEmiService = inject(TransaccionesEmisionService);

  cuentas: any[] = [];
  tiposOperacion: any[] = [];
  estatusOptions: any[] = [];
  operaciones: any[] = [];
  loading = false;
  errorMessage = '';
  elementosPorPagina = 10;
  paginaActual = 1;
  busquedaTabla = '';
  exportMenuAbierto = false;

  filtros: FormularioData & { montoDesde?: string; montoHasta?: string } = {
    cuenta: '',
    monto: '',
    montoDesde: '',
    montoHasta: '',
    numAuto: '',
    idEntidad: '',
    email: '',
    tel: '',
    estatus: '',
    tipoOperacion: '',
    fechaInicio: '',
    fechaFin: ''
  };

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.transEmiService.obtenerCuentas().subscribe({
      next: data => {
        this.cuentas = this.extraerLista(data);
      },
      error: error => console.error('Error al cargar cuentas:', error)
    });

    this.transEmiService.obtenerTiposOperacion().subscribe({
      next: data => {
        const response = data as any;
        this.tiposOperacion = this.extraerLista(response?.catOperationTypes ?? response);
      },
      error: error => console.error('Error al cargar tipos de operación:', error)
    });

    this.transEmiService.obtenerStatus().subscribe({
      next: data => this.estatusOptions = this.extraerLista(data).map((item: any) => ({
        ...item,
        value: item.idStatus ?? item.id ?? item.codigo ?? item.status ?? item.code,
        label: item.statusDescription ?? item.nombre ?? item.descripcion ?? item.description
      })),
      error: error => console.error('Error al cargar estatus:', error)
    });
  }

  onFechaInicioChange(event: any): void {
    this.filtros.fechaInicio = event.dateStr;
  }

  onFechaFinChange(event: any): void {
    this.filtros.fechaFin = event.dateStr;
  }

  buscarTransacciones(): void {
    this.errorMessage = '';

    if (!this.validarFechas()) {
      return;
    }

    this.loading = true;

    const request: FormularioData = {
      ...this.filtros,
      monto: this.filtros.montoDesde || this.filtros.monto || ''
    };

    this.transEmiService.enviarFormulario(request).subscribe({
      next: response => {
        this.operaciones = this.aplicarFiltrosLocales(this.extraerOperaciones(response));
        this.paginaActual = 1;
        this.loading = false;
      },
      error: error => {
        console.error('Error al consultar transacciones de emisión:', error);
        this.operaciones = [];
        this.errorMessage = 'No se pudieron consultar las transacciones de emisión.';
        this.loading = false;
      }
    });
  }

  private validarFechas(): boolean {
    const fechaInicio = this.obtenerFechaFiltro(this.filtros.fechaInicio);
    const fechaFin = this.obtenerFechaFiltro(this.filtros.fechaFin);

    if (!this.filtros.fechaInicio || !this.filtros.fechaFin) {
      this.errorMessage = 'Selecciona fecha inicio y fecha fin para buscar.';
      return false;
    }

    if ((fechaInicio && fechaInicio.getTime() > Date.now()) || (fechaFin && fechaFin.getTime() > Date.now())) {
      this.errorMessage = 'No puedes seleccionar una fecha mayor a la fecha actual.';
      return false;
    }

    if (fechaInicio && fechaFin && fechaFin.getTime() < fechaInicio.getTime()) {
      this.errorMessage = 'La fecha fin no puede ser anterior a la fecha inicio.';
      return false;
    }

    return true;
  }

  private obtenerFechaFiltro(value: unknown): Date | null {
    const texto = String(value ?? '').trim();
    if (!texto) return null;

    const fecha = new Date(texto.replace(' ', 'T'));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  limpiarFiltros(): void {
    this.filtros = {
      cuenta: '',
      monto: '',
      montoDesde: '',
      montoHasta: '',
      numAuto: '',
      idEntidad: '',
      email: '',
      tel: '',
      estatus: '',
      tipoOperacion: '',
      fechaInicio: '',
      fechaFin: ''
    };
    this.busquedaTabla = '';
    this.operaciones = [];
    this.paginaActual = 1;
    this.errorMessage = '';
  }

  get resumenTransacciones() {
    const montos = this.operaciones.map(item => this.toNumber(this.valorMonto(item)));
    const total = montos.reduce((acc, monto) => acc + monto, 0);

    return {
      totalTransacciones: this.operaciones.length,
      montoTotal: total,
      promedio: montos.length ? total / montos.length : 0,
      transaccionMasAlta: montos.length ? Math.max(...montos) : 0
    };
  }

  get operacionesFiltradasTabla(): any[] {
    const termino = this.busquedaTabla.trim().toLowerCase();
    if (!termino) return this.operaciones;

    return this.operaciones.filter(operacion =>
      Object.values(operacion).some(valor => String(valor ?? '').toLowerCase().includes(termino))
    );
  }

  get operacionesPaginadas(): any[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.operacionesFiltradasTabla.slice(inicio, inicio + this.elementosPorPagina);
  }

  private aplicarFiltrosLocales(operaciones: any[]): any[] {
    return operaciones.filter(operacion =>
      this.coincideTexto(this.filtros.cuenta, this.valorCuenta(operacion), operacion?.numCuenta, operacion?.account)
      && this.coincideEntidad(operacion)
      && this.coincideTipoOperacion(operacion)
      && this.coincideEstatus(operacion)
      && this.coincideMonto(this.valorMonto(operacion))
      && this.coincideTexto(this.filtros.numAuto, this.valorAutorizacion(operacion))
      && this.coincideTexto(this.filtros.email, operacion?.email, operacion?.payEmail, operacion?.userEmail)
      && this.coincideTexto(this.filtros.tel, operacion?.telephoneNumber, operacion?.phoneNumber, operacion?.payPhone, operacion?.telefono)
    );
  }

  private coincideEntidad(operacion: any): boolean {
    const valor = this.normalizarFiltro(this.filtros.idEntidad);
    if (!valor) return true;

    const cuenta = this.cuentas.find(item => this.normalizarFiltro(this.valorEntidad(item)) === valor);
    return this.coincideTexto(
      valor,
      this.valorCuenta(operacion),
      operacion?.sirioId,
      operacion?.sirioID,
      operacion?.bundle,
      operacion?.entityName,
      cuenta ? this.textoEntidad(cuenta) : ''
    );
  }

  private coincideTipoOperacion(operacion: any): boolean {
    const valor = this.normalizarFiltro(this.filtros.tipoOperacion);
    if (!valor) return true;

    const tipo = this.tiposOperacion.find(item =>
      this.normalizarFiltro(this.valorTipoOperacion(item)) === valor
    );
    const textoOperacion = this.normalizarFiltro(this.valorTipo(operacion));
    const textosTipo = [
      valor,
      tipo?.name,
      tipo?.nombre,
      tipo?.descripcion,
      tipo?.codigo
    ].map(item => this.normalizarFiltro(item)).filter(Boolean);

    return textosTipo.some(texto => textoOperacion.includes(texto) || texto.includes(textoOperacion));
  }

  private coincideEstatus(operacion: any): boolean {
    const valor = this.normalizarFiltro(this.filtros.estatus);
    if (!valor) return true;

    const estatus = this.estatusOptions.find(item => this.normalizarFiltro(item.value) === valor);
    const textoOperacion = this.normalizarFiltro(this.valorEstatus(operacion));
    const textosEstatus = [valor, estatus?.label].map(item => this.normalizarFiltro(item)).filter(Boolean);

    return textosEstatus.some(texto => textoOperacion.includes(texto) || texto.includes(textoOperacion));
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

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.operacionesFiltradasTabla.length / this.elementosPorPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, index) => index + 1);
  }

  cambiarPagina(pagina: number): void {
    this.paginaActual = Math.min(Math.max(pagina, 1), this.totalPaginas);
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

  exportarExcel(): void {
    const fecha = this.obtenerFechaArchivo();
    const worksheet = XLSX.utils.json_to_sheet(this.operacionesFiltradasTabla.map(item => this.exportRow(item)));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones Emision');
    XLSX.writeFile(workbook, `Transacciones-Emision-${fecha}.xlsx`);
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
    doc.text(`Transacciones-Emision-${fecha}`, 148, 23, { align: 'center' });

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
        0: { cellWidth: 24 },
        1: { cellWidth: 34 },
        2: { cellWidth: 40 },
        3: { cellWidth: 52 },
        4: { cellWidth: 24 },
        5: { cellWidth: 28 },
        6: { cellWidth: 32 }
      },
      head: [['ID', 'FECHA / HORA', 'CUENTA', 'TIPO', 'MONTO', 'ESTATUS', 'AUTORIZACION']],
      body: this.operacionesFiltradasTabla.map(item => [
        this.valorId(item),
        this.valorFecha(item),
        this.valorCuenta(item),
        this.valorTipo(item),
        this.formatCurrency(this.valorMonto(item)),
        this.valorEstatus(item),
        this.valorAutorizacion(item)
      ])
    });
    doc.save(`Transacciones-Emision-${fecha}.pdf`);
    this.exportMenuAbierto = false;
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
    const iconos: Record<string, string> = {
      venta: 'fa-cart-shopping',
      pago: 'fa-money-bill-wave',
      devolucion: 'fa-rotate-left',
      transferencia: 'fa-right-left',
      default: 'fa-receipt'
    };
    return iconos[this.tipoTransaccionClase(tipo)];
  }

  esDevolucion(tipo?: string): boolean {
    return this.normalizarTexto(tipo).includes('devolucion');
  }

  valorId(item: any): string {
    return item?.idOperation ?? item?.id ?? item?.transactionSecuence ?? 'ND';
  }

  valorFecha(item: any): string {
    return item?.creationDate ?? item?.authorizationDate ?? item?.updateDate ?? 'ND';
  }

  valorCuenta(item: any): string {
    return item?.numCuenta ?? item?.account ?? item?.bundle ?? item?.merchantName ?? 'ND';
  }

  valorTipo(item: any): string {
    return item?.operationType ?? item?.OperationType ?? item?.typeOperation ?? item?.transactiontype ?? 'ND';
  }

  valorMonto(item: any): number | string {
    return item?.amount ?? item?.monto ?? 0;
  }

  valorEstatus(item: any): string {
    return item?.statusDescription ?? item?.status ?? item?.estatus ?? 'ND';
  }

  valorAutorizacion(item: any): string {
    return item?.numeroAutorizacion ?? item?.authorizationNumber ?? item?.authNumber ?? 'ND';
  }

  valorEntidad(cuenta: any): string {
    return String(
      cuenta?.sirioId ??
      cuenta?.sirioID ??
      cuenta?.bundle ??
      cuenta?.issueId ??
      cuenta?.entitySonID ??
      cuenta?.entitySonId ??
      cuenta?.affiliationId ??
      cuenta?.fatherID ??
      cuenta?.fatherId ??
      cuenta?.idEntity ??
      cuenta?.idEntidad ??
      cuenta?.id ??
      ''
    );
  }

  textoEntidad(cuenta: any): string {
    const id = this.valorEntidad(cuenta);
    const nombre = cuenta?.bussinesName || cuenta?.businessName || cuenta?.name || cuenta?.nombre || '';
    return [id, nombre].filter(Boolean).join(' - ');
  }

  valorTipoOperacion(tipo: any): string {
    return String(
      tipo?.idOperationType
      ?? tipo?.idTransactionType
      ?? tipo?.transactionType
      ?? tipo?.id
      ?? tipo?.codigo
      ?? tipo?.code
      ?? tipo?.name
      ?? tipo?.nombre
      ?? tipo?.descripcion
      ?? ''
    );
  }

  textoTipoOperacion(tipo: any): string {
    return String(tipo?.name ?? tipo?.nombre ?? tipo?.descripcion ?? tipo?.description ?? tipo?.codigo ?? this.valorTipoOperacion(tipo));
  }

  valorStatusOperacion(estatus: any): string {
    return String(estatus?.value ?? estatus?.idStatus ?? estatus?.id ?? estatus?.codigo ?? estatus?.status ?? estatus?.code ?? '');
  }

  textoStatusOperacion(estatus: any): string {
    return String(estatus?.label ?? estatus?.statusDescription ?? estatus?.nombre ?? estatus?.descripcion ?? estatus?.description ?? this.valorStatusOperacion(estatus));
  }

  private exportRow(item: any) {
    return {
      ID: this.valorId(item),
      'FECHA / HORA': this.valorFecha(item),
      CUENTA: this.valorCuenta(item),
      TIPO: this.valorTipo(item),
      MONTO: this.formatCurrency(this.valorMonto(item)),
      ESTATUS: this.valorEstatus(item),
      AUTORIZACION: this.valorAutorizacion(item)
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

  private extraerOperaciones(response: any): any[] {
    return this.extraerLista(response?.content ?? response?.rows?.content ?? response?.rows ?? response);
  }

  private extraerLista(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.rows)) return value.rows;
    return [];
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

  private normalizarFiltro(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
