import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-step-afiliacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-afiliacion.component.html',
    styleUrls: ['../../preRegistro.component.css']
})
export class StepAfiliacionComponent {
  @Input() form!: FormGroup;
  @Input() requisitos: string[] = [];
  @Input() validando = false;
  @Input() errorValidacion = '';
  @Output() continuar = new EventEmitter<void>();
  @Output() abrirAyuda = new EventEmitter<void>();

  mostrarErrorNumeros = false;

  validarEntradaAfiliacion(event: InputEvent): void {
    if (event.data && /[^0-9]/.test(event.data)) {
      this.mostrarErrorNumeros = true;
      event.preventDefault();
    }
  }

  filtrarAfiliacion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const soloNumeros = input.value.replace(/[^0-9]/g, '');
    this.mostrarErrorNumeros = input.value !== soloNumeros;
    if (this.mostrarErrorNumeros) {
      input.value = soloNumeros;
      this.form.get('afiliacion')?.setValue(soloNumeros);
    }
  }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  submit(): void {
    if (this.validando) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }
}
