import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentoRequerido } from '../../models/preregistro.models';
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
  @Output() seleccionarArchivo = new EventEmitter<{ event: Event; documento: DocumentoRequerido }>();
  @Output() finalizar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  validacionesMesaDigital: Record<number, 'cumple' | 'no-cumple'> = {};

  get documentosValidados(): number {
    return Object.keys(this.validacionesMesaDigital).length;
  }

  get documentosAprobados(): number {
    return Object.values(this.validacionesMesaDigital).filter(estado => estado === 'cumple').length;
  }

  get documentosRechazados(): number {
    return Object.values(this.validacionesMesaDigital).filter(estado => estado === 'no-cumple').length;
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
  }

  estadoDocumento(documento: DocumentoRequerido): 'cumple' | 'no-cumple' | undefined {
    return this.validacionesMesaDigital[documento.numero];
  }
}
