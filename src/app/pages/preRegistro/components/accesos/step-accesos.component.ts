import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-step-accesos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-accesos.component.html',
  styleUrls: ['../../preRegistro.component.css']
})
export class StepAccesosComponent {
  @Input() form!: FormGroup;
  @Input() modosReserva: readonly string[] = [];
  @Input() mostrarAdminTotal = true;
  @Input() mostrarPerfilReserva = false;
  @Input() mostrarReservaSplit = false;
  @Input() mostrarPinSupervisor = true;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  get modoSeleccionado(): string {
  return this.form.get('modoReserva')?.value ?? 'NINGUNO';
}

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.continuar.emit();
  }
}