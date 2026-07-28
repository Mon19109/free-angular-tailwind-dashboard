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
      next: data => this.cuentas = this.extraerLista(data),
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
        value: item.idStatus ?? item.id ?? item.codigo,
        label: item.statusDescription ?? item.nombre ?? item.descripcion
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
    this.loading = true;
    this.errorMessage = '';

    const request: FormularioData = {
      ...this.filtros,
      monto: this.filtros.montoDesde || this.filtros.monto || ''
    };

    this.transEmiService.enviarFormulario(request).subscribe({
      next: response => {
        this.operaciones = this.extraerOperaciones(response);
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
      minimumFractionDigits: 2
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
    const worksheet = XLSX.utils.json_to_sheet(this.operacionesFiltradasTabla.map(item => this.exportRow(item)));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones Emision');
    XLSX.writeFile(workbook, 'transacciones-emision.xlsx');
    this.exportMenuAbierto = false;
  }

  exportarPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Consulta de Transacciones Emision', 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['ID', 'Fecha / Hora', 'Cuenta', 'Tipo', 'Monto', 'Estatus', 'Autorizacion']],
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
    doc.save('transacciones-emision.pdf');
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

  private exportRow(item: any) {
    return {
      ID: this.valorId(item),
      'Fecha / Hora': this.valorFecha(item),
      Cuenta: this.valorCuenta(item),
      Tipo: this.valorTipo(item),
      Monto: this.toNumber(this.valorMonto(item)),
      Estatus: this.valorEstatus(item),
      Autorizacion: this.valorAutorizacion(item)
    };
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
}
