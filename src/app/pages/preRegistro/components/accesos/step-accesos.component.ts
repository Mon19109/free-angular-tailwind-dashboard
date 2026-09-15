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

  get indicadorAccesosTitulo(): string {
    if (this.usuarios.some(usuario => usuario.prefijo === 'fac') && this.usuarios.some(usuario => usuario.prefijo === 'tkt')) {
      return 'Captura de cuentas FAC y TKT';
    }

    if (this.usuarios.length > 1) return 'Captura de accesos requeridos';

    return 'Captura de cuenta administrador';
  }

  get indicadorAccesosDescripcion(): string {
    if (this.usuarios.some(usuario => usuario.prefijo === 'fac') && this.usuarios.some(usuario => usuario.prefijo === 'tkt')) {
      return 'Completa primero una cuenta y usa el botón Siguiente cuenta para capturar la otra. Al enviar, se guardará la información de ambas cuentas.';
    }

    if (this.usuarios.length > 1) {
      return 'Llena la información de cada usuario solicitado. Al enviar, se guardará la información de todos los accesos requeridos.';
    }

    return 'Llena la información del usuario administrador. Al enviar, se guardará solo esta cuenta.';
  }

  get usuarioActual(): UsuarioAccesoConfig | undefined {
    return this.usuarios.find(usuario => usuario.prefijo === this.usuarioActivo) ?? this.usuarios[0];
  }

  get indiceUsuarioActivo(): number {
    const indice = this.usuarios.findIndex(usuario => usuario.prefijo === this.usuarioActivo);
    return indice >= 0 ? indice : 0;
  }

  get mostrarNavegacionUsuarios(): boolean {
    return this.mostrarResumenUsuarios && this.usuarios.length > 1;
  }

  get puedeIrUsuarioAnterior(): boolean {
    return this.indiceUsuarioActivo > 0;
  }

  get puedeIrUsuarioSiguiente(): boolean {
    return this.indiceUsuarioActivo < this.usuarios.length - 1;
  }

  get textoUsuarioSiguiente(): string {
    const siguiente = this.usuarios[this.indiceUsuarioActivo + 1];
    return siguiente ? `Siguiente cuenta: ${siguiente.titulo.replace('Usuario ', '')}` : 'Siguiente cuenta';
  }

  usuarioEstaCompleto(prefijo: string): boolean {
    const campos = ['Nombre', 'Paterno', 'Materno', 'Correo', 'ConfirmarCorreo', 'Telefono'];
    return campos.every(campo => {
      const control = this.form.get(this.campo(prefijo, campo));
      return !!control?.valid && !!`${control.value ?? ''}`.trim();
    });
  }

  seleccionarUsuario(prefijo: string): void {
    this.usuarioActivoChange.emit(prefijo);
  }

  irUsuarioAnterior(): void {
    const anterior = this.usuarios[this.indiceUsuarioActivo - 1];
    if (anterior) this.seleccionarUsuario(anterior.prefijo);
  }

  irUsuarioSiguiente(): void {
    const siguiente = this.usuarios[this.indiceUsuarioActivo + 1];
    if (siguiente) this.seleccionarUsuario(siguiente.prefijo);
  }

  correosDistintos(prefijo: string): boolean {
    const errorKey = `${prefijo}CorreosDistintos`;
    return !!(this.form.hasError(errorKey) && this.form.get(this.campo(prefijo, 'ConfirmarCorreo'))?.touched);
  }
}
