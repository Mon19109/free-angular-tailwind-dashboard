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
  @Output() seleccionarArchivo = new EventEmitter<{ event: Event; documento: DocumentoRequerido }>();
  @Output() finalizar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
}
