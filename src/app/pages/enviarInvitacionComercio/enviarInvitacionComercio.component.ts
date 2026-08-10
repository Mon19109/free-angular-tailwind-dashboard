import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
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
  private readonly authService = inject(AuthService);

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
    const affiliationNumber = String(this.authService.getUserData()?.affiliationNumber ?? '').trim();

    if (!email || !name) {
      this.error = 'Captura el correo electrónico y el nombre del comercio.';
      return;
    }

    if (!affiliationNumber) {
      this.error = 'No se encontró el número de afiliación de la cuenta.';
      return;
    }

    if (!this.esCorreoValido(email)) {
      this.error = 'Captura un correo electrónico válido.';
      return;
    }

    this.cargando = true;
    this.invitacionService.enviarInvitacion({ email, name, affiliationNumber }).subscribe({
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
