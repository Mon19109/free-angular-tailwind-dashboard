import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

export interface UsuarioAccesoConfig {
  prefijo: string;
  titulo: string;
  descripcion: string;
  icono?: string;
}

@Component({
  selector: 'app-step-accesos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-accesos.component.html',
  styleUrls: ['../../preRegistro.component.css']
})
export class StepAccesosComponent {
  @Input() form!: FormGroup;
  @Input() textoContinuar = 'Guardar y continuar';
  @Input() mostrarResumenUsuarios = false;
  @Input() usuarioActivo = '';
  @Input() usuarios: UsuarioAccesoConfig[] = [
    {
      prefijo: 'admin',
      titulo: 'Administrador de la Plataforma',
      descripcion: 'con Acceso Total y Gestión de Pagos.',
      icono: 'fa-regular fa-user'
    }
  ];
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() usuarioActivoChange = new EventEmitter<string>();

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.continuar.emit();
  }

  campo(prefijo: string, nombre: string): string {
    return `${prefijo}${nombre}`;
  }

  usuariosVisibles(): UsuarioAccesoConfig[] {
    if (!this.mostrarResumenUsuarios) return this.usuarios;
    return this.usuarios.filter(usuario => usuario.prefijo === this.usuarioActivo);
  }

  seleccionarUsuario(prefijo: string): void {
    this.usuarioActivoChange.emit(prefijo);
  }

  correosDistintos(prefijo: string): boolean {
    const errorKey = `${prefijo}CorreosDistintos`;
    return !!(this.form.hasError(errorKey) && this.form.get(this.campo(prefijo, 'ConfirmarCorreo'))?.touched);
  }
}
