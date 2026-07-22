import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnviarInvitacionComercioService } from '../../services/enviar-invitacion-comercio.service';

@Component({
  selector: 'app-enviar-invitacion-comercio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enviarInvitacionComercio.component.html',
  styleUrls: ['./enviarInvitacionComercio.component.css'],
})
export class EnviarInvitacionComercioComponent {
  private readonly invitacionService = inject(EnviarInvitacionComercioService);

  correoElectronico = '';
  nombre = '';
  cargando = false;
  mensaje = '';
  error = '';

  continuar(): void {
    this.mensaje = '';
    this.error = '';

    const email = this.correoElectronico.trim();
    const name = this.nombre.trim();

    if (!email || !name) {
      this.error = 'Captura el correo electrónico y el nombre del comercio.';
      return;
    }

    if (!this.esCorreoValido(email)) {
      this.error = 'Captura un correo electrónico válido.';
      return;
    }

    this.cargando = true;
    this.invitacionService.enviarInvitacion({ email, name }).subscribe({
      next: () => {
        this.cargando = false;
        this.mensaje = 'Invitación enviada correctamente.';
        this.cancelar(false);
      },
      error: error => {
        this.cargando = false;
        console.error('Error al enviar invitación:', error);
        this.error = 'No fue posible enviar la invitación. Intenta nuevamente.';
      },
    });
  }

  cancelar(limpiarMensajes = true): void {
    this.correoElectronico = '';
    this.nombre = '';
    if (limpiarMensajes) {
      this.mensaje = '';
      this.error = '';
    }
  }

  private esCorreoValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
