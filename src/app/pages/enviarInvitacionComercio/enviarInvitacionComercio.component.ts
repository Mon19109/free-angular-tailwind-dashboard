import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
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
export class EnviarInvitacionComercioComponent implements OnDestroy {
  private readonly invitacionService = inject(EnviarInvitacionComercioService);
  private readonly authService = inject(AuthService);
  private limpiarMensajeTimeout?: ReturnType<typeof setTimeout>;

  correoElectronico = '';
  nombre = '';
  cargando = false;
  mensaje = '';
  error = '';

  continuar(): void {
    this.cancelarLimpiezaMensaje();
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
        this.limpiarMensajeTimeout = setTimeout(() => {
          this.mensaje = '';
          this.limpiarMensajeTimeout = undefined;
        }, 3000);
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
      this.cancelarLimpiezaMensaje();
      this.mensaje = '';
      this.error = '';
    }
  }

  ngOnDestroy(): void {
    this.cancelarLimpiezaMensaje();
  }

  private esCorreoValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private cancelarLimpiezaMensaje(): void {
    if (this.limpiarMensajeTimeout) {
      clearTimeout(this.limpiarMensajeTimeout);
      this.limpiarMensajeTimeout = undefined;
    }
  }
}
