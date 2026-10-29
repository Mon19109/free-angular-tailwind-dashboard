import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentoRequerido } from '../../models/preregistro.models';
import { SipreladResultado } from '../../../../services/siprelad.service';
@Component({
  selector: 'app-step-documentos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-documentos.component.html',
    styleUrls: ['../../preRegistro.component.css']
})
export class StepDocumentosComponent implements OnChanges {
 @Input() estadoConsultaDocumentos: 'idle' | 'loading' | 'error' | 'empty' | 'ready' | null = null;
 @Input() documentos: DocumentoRequerido[] = [];
  @Input() documentosCargados = 0;
  @Input() documentosPendientes = 0;
  @Input() archivosInvalidos = false;
  @Input() textoFinalizar = 'Enviar preregistro';
  @Input() mostrarMesaDigital = false;
  @Input() soloConsulta = false;
  @Input() mostrarAccionesAdministrativas = true;
  @Input() mostrarObservacionesConsulta = false;
  @Input() permitirRevision = true;
  @Input() permitirNotificacion = true;
  @Input() emailSoloLectura = false;
  @Input() emailMaxLength = 100;
  @Input() mostrarMismaDocumentacionEntidad = false;
  @Input() mismaDocumentacionEntidad = false;
  @Input() resultadoSiprelad = 'No se encontraron registros relacionados con PLD';
  @Input() resultadosSiprelad: SipreladResultado[] = [];
  @Input() observacionesCliente = '';
  @Input() observacionesInternas = '';
  @Input() emailNotificacion = '';
  @Input() enviandoNotificacion = false;
  @Input() guardandoBorrador = false;
  @Input() deshabilitarFinalizar = false;
  @Input() mensajeNotificacion = '';
  @Output() seleccionarArchivo = new EventEmitter<{ event: Event; documento: DocumentoRequerido }>();
  @Output() verArchivo = new EventEmitter<DocumentoRequerido>();
  @Output() validarArchivo = new EventEmitter<{ documento: DocumentoRequerido; estado: 'APPROVED' | 'REJECTED' }>();
  @Output() observacionesClienteChange = new EventEmitter<string>();
  @Output() observacionesInternasChange = new EventEmitter<string>();
  @Output() emailNotificacionChange = new EventEmitter<string>();
  @Output() enviarNotificacion = new EventEmitter<void>();
  @Output() guardarBorrador = new EventEmitter<void>();
  @Output() cambiarMismaDocumentacionEntidad = new EventEmitter<boolean>();
  @Output() finalizar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  @Input() permitirAgregarDocumento = false;
  @Input() documentosDisponibles: DocumentoRequerido[] = [];
  @Input() subiendoDocumento = false;
  @Input() contextoDocumento = '';
  @Input() mensajeCargaDocumento = '';
  @Output() subirDocumento = new EventEmitter<{ archivo: File; documento: DocumentoRequerido }>();
  mostrarCargaDocumento = false;
  tipoDocumentoNuevo = 0;
  archivoNuevo: File | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contextoDocumento']) this.validacionesMesaDigital = {};
    if (changes['contextoDocumento'] || (changes['subiendoDocumento']?.previousValue && !this.subiendoDocumento)) {
      this.mostrarCargaDocumento = false;
      this.tipoDocumentoNuevo = 0;
      this.archivoNuevo = null;
    }
  }

  get documentoNuevo(): DocumentoRequerido | undefined {
    return this.documentosDisponibles.find(documento => documento.numero === this.tipoDocumentoNuevo);
  }

  elegirArchivoNuevo(event: Event): void {
    this.archivoNuevo = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  cargarDocumentoNuevo(): void {
    if (!this.permitirAgregarDocumento || this.soloConsulta || this.subiendoDocumento || !this.archivoNuevo || !this.documentoNuevo) return;
    this.subirDocumento.emit({ archivo: this.archivoNuevo, documento: this.documentoNuevo });
  }

  validacionesMesaDigital: Record<number, 'cumple' | 'no-cumple'> = {};

  get documentosValidados(): number {
    return this.documentos.filter(documento => this.estadoDocumento(documento)).length;
  }

  get documentosAprobados(): number {
    return this.documentos.filter(documento => this.estadoDocumento(documento) === 'cumple').length;
  }

  get documentosRechazados(): number {
    return this.documentos.filter(documento => this.estadoDocumento(documento) === 'no-cumple').length;
  }

  get documentosSinValidar(): number {
    if (this.estadoConsultaDocumentos !== null) return this.documentos.filter(documento => documento.estatusRevision === 'IN_REVIEW').length;
    return Math.max(this.documentos.length - this.documentosValidados, 0);
  }

  get estadoGeneralMesaDigital(): string {
    if (this.estadoConsultaDocumentos !== null && this.documentos.some(documento => !documento.estatusRevision)) return 'No disponible';
    if (this.documentosSinValidar > 0) return 'En Revisión';
    return this.documentosRechazados > 0 ? 'Con Rechazos' : 'Aprobado';
  }

  validarDocumento(documento: DocumentoRequerido, estado: 'cumple' | 'no-cumple'): void {
    if (!this.mostrarAccionesAdministrativas || this.soloConsulta || !this.permitirRevision) return;
    this.validacionesMesaDigital[documento.numero] = estado;
    this.validarArchivo.emit({
      documento,
      estado: estado === 'cumple' ? 'APPROVED' : 'REJECTED',
    });
  }

  estadoDocumento(documento: DocumentoRequerido): 'cumple' | 'no-cumple' | undefined {
    return this.validacionesMesaDigital[documento.numero] ?? this.estadoDocumentoDesdeApi(documento);
  }

  verDocumento(documento: DocumentoRequerido): void {
    this.verArchivo.emit(documento);
  }

  private estadoDocumentoDesdeApi(documento: DocumentoRequerido): 'cumple' | 'no-cumple' | undefined {
    if (documento.estatusRevision === 'APPROVED') return 'cumple';
    if (documento.estatusRevision === 'REJECTED') return 'no-cumple';
    return undefined;
  }
}
