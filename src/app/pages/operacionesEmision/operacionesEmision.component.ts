import { leerPaginaOperaciones } from '../../shared/utils/pagina-operaciones';
import { accionOperacion } from '../../shared/utils/acciones-operaciones';
import { fechaOperacion } from '../../shared/utils/operaciones-tabla';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DetalleOperacionComponent } from '../detalleOperacion/detalle-operacion.component';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FiltrosDetalleLiquidacion, OperacionesEmisionService } from '../../services/operacionesemision.service';
import { MultiSelectComponent, Option }
from '../../shared/components/form/multi-select/multi-select.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import * as XLSX from 'xlsx';
import { nombreEstatusOperacion } from '../../shared/utils/estatus-operaciones';
import { nombreBancoPorCodigo } from '../../shared/utils/bancos';


//import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';

@Component({
  selector: 'app-operacionesEmi',
  standalone: true,
  imports: [DetalleOperacionComponent, CommonModule, ReactiveFormsModule, MultiSelectComponent, DatePickerComponent, ProcessingOverlayComponent],
  templateUrl: './operacionesEmision.component.html',
  styleUrls: ['./operacionesEmision.component.css']
})
export class OperacionesEmisionComponent implements OnInit {
  readonly buscando = signal(false);
  readonly nombreEstatusOperacion = nombreEstatusOperacion;
  readonly nombreBancoPorCodigo = nombreBancoPorCodigo;
  liquidacionSeleccionada: { referencia: string; filtros: FiltrosDetalleLiquidacion } | null = null;

  private readonly destroyRef = inject(DestroyRef);

  formulario: FormGroup;
  fechaErrorMensaje = '';
  //cuentas: any[] = [];
  entidades: any[] = [];
  tiposOperacion: any[] = [];
  operaciones: any[] = [];

operacionSeleccionada: any = null;
tipoDetalleSeleccionado: number | null = null;
mostrarModalDetalle = false;

  tipoOperacionOptions: Option[] = [];
  estatusMultiOptions: Option[] = [];
defaultEstatus: string[] = ['15', '31'];
defaultTipoOperacion = ['11', '22', '24', '30'];

  estatusOptions = [
    { label: 'Procesando', value: '5' },
    { label: 'Denegado', value: '6' },
    { label: 'Reversado', value: '7' },
    { label: 'Cancelado', value: '8' },
    { label: 'Reversando', value: '10' },
    { label: 'Devuelto', value: '11' },
    { label: 'Aprobado', value: '15' },
    { label: 'Creado', value: '25' },
    { label: 'Pendiente de envío', value: '26' },
    { label: 'Enviado', value: '27' },
    { label: 'Rechazado', value: '28' },
    { label: 'Confirmado', value: '29' },
    { label: 'Conciliado', value: '30' },
    { label: 'Liquidado', value: '31' },
    { label: 'Cerrado', value: '32' },
    { label: 'Tarifa dividida', value: '33' }
  ];

  opciones = [
    { id: 1, nombre: 'Opción 1' },
    { id: 2, nombre: 'Opción 2' },
    { id: 3, nombre: 'Opción 3' },
    { id: 4, nombre: 'Opción 4' }
  ];
  
  seleccionados: number[] = [];
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }
onTipoOperacionChange(selected: string[]) {
  this.formulario.patchValue({
    tipoOperacion: selected
  });

  console.log('Tipos:', selected);
}

onEstatusChange(selected: string[]) {
  this.formulario.patchValue({
    estatus: selected
  });

  console.log('Estatus:', selected);
}

onFechaInicioChange(event: any) {

  this.formulario.patchValue({
    fechaInicio: event.dateStr
  });

  console.log('Fecha Inicio:', event.dateStr);

}

onFechaFinChange(event: any) {

  this.formulario.patchValue({
    fechaFin: event.dateStr
  });

  console.log('Fecha Fin:', event.dateStr);

}


  private  operaEmiService = inject(OperacionesEmisionService);
  
  constructor(
    private fb: FormBuilder
  ) {
  this.formulario = this.fb.group({
  cuenta: [''],
  estatus: [[]],
  tipoOperacion: [[]],
  fechaInicio: ['', [Validators.required, this.fechaNoFuturaValidator]],
  fechaFin: ['', [Validators.required, this.fechaNoFuturaValidator]]
});
  }

  ngOnInit(): void {

  this.estatusMultiOptions = this.estatusOptions.map(item => ({
    value: item.value,
    text: item.label
  }));

  this.cargarDatosIniciales();
}

  cargarDatosIniciales(): void {
    // Cargar cuentas
   this.operaEmiService.obtenerCuentas().subscribe({
  next: (data) => {
    this.entidades = data.filter((entidad: any) => entidad.active === true && Number(entidad.type) === 4);
  }
});

   // Cargar tipos de operación
this.operaEmiService.obtenerTiposOperacion().subscribe({
  next: (data: any) => {

    this.tiposOperacion = Array.isArray(data) ? data : (data?.catOperationTypes ?? []);

    if (!this.tiposOperacion.some(tipo => String(tipo.idOperationType) === '10008')) {
      this.tiposOperacion = [...this.tiposOperacion, {
        idOperationType: 10008,
        name: 'Liquidación Compras',
        showPortal: 1,
        descriptionApp: 'Liquidación total Day Settlement'
      }];
    }

    this.tipoOperacionOptions = this.tiposOperacion.map((tipo: any) => ({
      value: String(tipo.idOperationType),
      text: tipo.descriptionApp || tipo.description || String(tipo.idOperationType)
    }));
    this.defaultTipoOperacion = [...new Set([
      ...this.tipoOperacionOptions.slice(0, 3).map(tipo => tipo.value),
      '10008'
    ])];
    this.formulario.patchValue({ tipoOperacion: this.defaultTipoOperacion });
  

  },
  error: (error) => {
    console.error('Error al cargar tipos de operación:', error);
  }
});
  }

  paginaActual = 1;
  totalRegistros: number | null = null;
  haySiguiente = false;
  consultaRealizada = false;
  errorResultados = '';
  private filtrosConsulta: any = null;

  get paginas(): number[] {
    const total = this.totalRegistros === null
      ? this.paginaActual + (this.haySiguiente ? 1 : 0)
      : Math.max(1, Math.ceil(this.totalRegistros / 10));
    const inicio = Math.max(1, Math.min(this.paginaActual - 2, total - 4));
    return Array.from({ length: Math.min(5, total - inicio + 1) }, (_, i) => inicio + i);
  }

  onSubmit(): void {
    if (this.buscando()) return;
    this.fechaErrorMensaje = this.obtenerMensajeValidacionFechas();
    if (this.fechaErrorMensaje || !this.formulario.valid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const formValues = this.formulario.getRawValue();
    this.filtrosConsulta = formValues;
    this.operaciones = [];
    this.totalRegistros = null;
    this.haySiguiente = false;
    this.paginaActual = 1;
    this.cambiarPagina(1);
  }

  cambiarPagina(pagina: number): void {
    if (this.buscando() || !this.filtrosConsulta || pagina < 1) return;
    this.errorResultados = '';
    this.buscando.set(true);
    this.operaEmiService.enviarFormulario(this.filtrosConsulta, pagina - 1).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.buscando.set(false))
    ).subscribe({
      next: response => {
        const resultado = leerPaginaOperaciones(response, pagina);
        this.operaciones = resultado.operaciones;
        this.totalRegistros = resultado.total;
        this.haySiguiente = resultado.siguiente;
        this.paginaActual = pagina;
        this.consultaRealizada = true;
      },
      error: () => { this.errorResultados = 'No fue posible consultar las operaciones. Intenta de nuevo.'; }
    });
  }

  cargarTiposOperacion(): void {
    this.operaEmiService.obtenerTiposOperacion().subscribe({
      next: (response: any) => {
        // Acceder a catOperationTypes dentro de la respuesta
        this.tiposOperacion = response.catOperationTypes || [];
        console.log('Tipos de operación:', this.tiposOperacion);
      },
      error: (error) => {
        console.error('Error:', error);
        this.tiposOperacion = [];
      }
    });
  }

  limpiarFormulario(): void {
    this.operaciones = [];
    this.filtrosConsulta = null;
    this.consultaRealizada = false;
    this.errorResultados = '';
    this.totalRegistros = null;
    this.paginaActual = 1;
    this.haySiguiente = false;

  this.formulario.reset({
    cuenta: '',
    estatus: [],
    tipoOperacion: [],
    fechaInicio: '',
    fechaFin: ''
  });
  this.fechaErrorMensaje = '';

}

readonly fechaOperacion = fechaOperacion;

readonly accionOperacion = accionOperacion;

etiquetaDetalle(operacion: any): string {
  return accionOperacion(operacion.type)?.titulo || '';
}

conceptoComprobante(operacion: any): string {
  const descripcion = String(operacion.description ?? '');
  const partes = descripcion.split('|');
  return partes.length >= 3 ? partes[2] : descripcion || 'N/A';
}

verDetalle(operacion: any): void {

  const tipo = Number(operacion.type);

  switch (tipo) {

   case 10008:
  this.liquidacionSeleccionada = {
    referencia: String(operacion.numericReference ?? ''),
    filtros: {
      startDate: this.formulario.getRawValue().fechaInicio || '',
      endDate: this.formulario.getRawValue().fechaFin || '',
      type: String(operacion.type),
      status: String(operacion.status ?? '')
    }
  };
  break;

    case 1:
      this.mostrarComprobanteSpei(operacion);
      break;

    case 4:
      this.mostrarComprobanteRetiro(operacion);
      break;

    case 10:
      this.mostrarRecargaTae(operacion);
      break;

    case 11:
      this.mostrarPagoServicio(operacion);
      break;

    default:
      console.log('La operación no tiene detalle:', operacion);
      break;
  }
}

private mostrarComprobanteSpei(operacion: any): void {
  this.operacionSeleccionada = operacion;
  this.tipoDetalleSeleccionado = 1;
  this.mostrarModalDetalle = true;
}

private mostrarComprobanteRetiro(operacion: any): void {
  this.operacionSeleccionada = operacion;
  this.tipoDetalleSeleccionado = 4;
  this.mostrarModalDetalle = true;
}

private mostrarRecargaTae(operacion: any): void {
  this.operacionSeleccionada = operacion;
  this.tipoDetalleSeleccionado = 10;
  this.mostrarModalDetalle = true;
}

private mostrarPagoServicio(operacion: any): void {
  this.operacionSeleccionada = operacion;
  this.tipoDetalleSeleccionado = 11;
  this.mostrarModalDetalle = true;
}

cerrarDetalle(): void {
  this.mostrarModalDetalle = false;
  this.operacionSeleccionada = null;
  this.tipoDetalleSeleccionado = null;
}

  exportarExcel(): void {
    if (!this.operaciones?.length) return;

    const fecha = this.obtenerFechaArchivo();
    const encabezados = [
      'ID',
      'TIPO',
      'MONTO',
      'ESTATUS',
      'DESCRIPCION',
      'FECHA',
      'CODIGO DE RESPUESTA',
      'REFERENCIA NUMERICA',
      'REFERENCIA ALFANUMERICA',
      'NOMBRE DEL DESTINATARIO',
      'CUENTA DESTINATARIO',
      'CODIGO DESTINATARIO',
      'EMAIL DESTINATARIO',
      'REFERENCIA INTERNA',
      'REFERENCIA EXTERNA',
      'TRANSACTIONBUNDLER',
      'OBSERVACION',
      'USUARIO',
      'DETALLE'
    ];

    const filas = this.operaciones.map(operacion => [
      operacion.id ?? '',
      operacion.descriptionType ?? '',
      this.formatoExcelMoneda(operacion.amount),
      //this.obtenerEstatusOperacion(operacion.status),
      nombreEstatusOperacion(operacion.status),
      operacion.description ?? '',
      this.formatoExcelFecha(operacion.createdAt),
      operacion.responseCode ?? '',
      operacion.numericReference ?? '',
      operacion.alphanumericReference ?? '',
      operacion.targetName ?? '',
      operacion.targetID ?? '',
      operacion.targetIDCode ?? '',
      operacion.targetEmail ?? '',
      operacion.internalReference ?? '',
      operacion.externalReference ?? '',
      operacion.transactionBundler ?? '',
      operacion.observation ?? '',
      operacion.originalUsername ?? '',
      ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`Operaciones-Emision-${fecha}`],
      encabezados,
      ...filas
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } }];
    worksheet['!cols'] = encabezados.map((encabezado) => ({ wch: Math.max(14, Math.min(34, encabezado.length + 4)) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operaciones');
    XLSX.writeFile(workbook, `Operaciones-Emision-${fecha}.xlsx`);
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatoExcelMoneda(value: unknown): string {
    const amount = Number(value || 0);
    return `$ ${amount.toFixed(2)}`;
  }

  private formatoExcelFecha(value: unknown): string {
    if (!value) return '';
    const fecha = new Date(String(value));
    if (Number.isNaN(fecha.getTime())) return String(value);
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = String(fecha.getFullYear()).slice(-2);
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }


  private obtenerMensajeValidacionFechas(): string {
    const fechaInicio = this.formulario.get('fechaInicio');
    const fechaFin = this.formulario.get('fechaFin');

    if (fechaInicio?.hasError('required') || fechaFin?.hasError('required')) {
      return 'Selecciona fecha inicio y fecha fin para buscar.';
    }

    if (fechaInicio?.hasError('fechaFutura') || fechaFin?.hasError('fechaFutura')) {
      return 'No puedes seleccionar una fecha mayor a la fecha actual.';
    }

    const inicio = this.obtenerFechaFormulario(fechaInicio?.value);
    const fin = this.obtenerFechaFormulario(fechaFin?.value);

    if (inicio && fin && fin.getTime() < inicio.getTime()) {
      return 'La fecha fin no puede ser anterior a la fecha inicio.';
    }

    return '';
  }

  private fechaNoFuturaValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value) return null;

    const fecha = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(fecha.getTime())) return null;

    return fecha.getTime() > Date.now() ? { fechaFutura: true } : null;
  }

  private obtenerFechaFormulario(value: unknown): Date | null {
    const texto = String(value ?? '').trim();
    if (!texto) return null;

    const fecha = new Date(texto.replace(' ', 'T'));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  
}


  
