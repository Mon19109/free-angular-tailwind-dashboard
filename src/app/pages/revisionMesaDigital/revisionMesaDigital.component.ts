import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface DocumentoRevision {
  numero: number;
  nombre: string;
  obligatorio: boolean;
  estado: 'Subido' | 'Pendiente';
  aprobado: boolean;
}

@Component({
  selector: 'app-revision-mesa-digital',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revisionMesaDigital.component.html',
  styleUrls: ['./revisionMesaDigital.component.css'],
})
export class RevisionMesaDigitalComponent {
  observacionesCliente = '';
  observacionesInternas = '';
  emailCliente = '';

  documentos: DocumentoRevision[] = [
    { numero: 1, nombre: 'Comprobante de domicilio', obligatorio: true, estado: 'Subido', aprobado: true },
    { numero: 2, nombre: 'Identificación Oficial del Propietario', obligatorio: true, estado: 'Subido', aprobado: true },
    { numero: 3, nombre: 'Imagen Frente', obligatorio: false, estado: 'Subido', aprobado: true },
    { numero: 6, nombre: 'Imagen Interior', obligatorio: false, estado: 'Subido', aprobado: false },
    { numero: 7, nombre: 'Imagen Interior 2 del comercio', obligatorio: false, estado: 'Subido', aprobado: false },
    { numero: 9, nombre: 'Poder del Representante', obligatorio: false, estado: 'Subido', aprobado: true },
    { numero: 10, nombre: 'Constancia Situación Fiscal', obligatorio: false, estado: 'Subido', aprobado: true },
    { numero: 11, nombre: 'E-Firma', obligatorio: false, estado: 'Subido', aprobado: true },
    { numero: 12, nombre: 'Identificación Oficial del Representante', obligatorio: false, estado: 'Subido', aprobado: true },
    { numero: 14, nombre: 'Identificación Oficial de un tercero', obligatorio: false, estado: 'Subido', aprobado: false },
  ];

  get aprobados(): number {
    return this.documentos.filter(documento => documento.aprobado).length;
  }

  get rechazados(): number {
    return this.documentos.filter(documento => !documento.aprobado && documento.estado === 'Subido').length;
  }

  get pendientes(): number {
    return this.documentos.filter(documento => documento.estado === 'Pendiente').length;
  }

  get estadoGeneral(): string {
    return this.rechazados || this.pendientes ? 'En Revisión' : 'Aprobado';
  }

  enviarNotificacion(): void {
    // Conectar al servicio cuando exista el endpoint de notificación.
  }

  guardarBorrador(): void {
    // Conectar al servicio cuando exista persistencia de revisión.
  }

  registrarCliente(): void {
    // Conectar al servicio cuando se defina el alta final.
  }
}
