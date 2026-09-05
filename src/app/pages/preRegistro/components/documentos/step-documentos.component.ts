import { Component, EventEmitter, Input, Output } from '@angular/core';
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
export class StepDocumentosComponent {
 @Input() documentos: DocumentoRequerido[] = [];
  @Input() documentosCargados = 0;
  @Input() documentosPendientes = 0;
  @Input() archivosInvalidos = false;
  @Input() textoFinalizar = 'Enviar preregistro';
  @Input() mostrarMesaDigital = false;
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
    return Math.max(this.documentos.length - this.documentosValidados, 0);
  }

  get estadoGeneralMesaDigital(): string {
    if (this.documentosSinValidar > 0) return 'En Revisión';
    return this.documentosRechazados > 0 ? 'Con Rechazos' : 'Aprobado';
  }

  validarDocumento(documento: DocumentoRequerido, estado: 'cumple' | 'no-cumple'): void {
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
