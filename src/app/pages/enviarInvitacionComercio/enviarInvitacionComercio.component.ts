import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-enviar-invitacion-comercio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enviarInvitacionComercio.component.html',
  styleUrls: ['./enviarInvitacionComercio.component.css'],
})
export class EnviarInvitacionComercioComponent {
  correoElectronico = '';
  nombre = '';

  continuar(): void {}

  cancelar(): void {
    this.correoElectronico = '';
    this.nombre = '';
  }
}
