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
  @Output() continuar = new EventEmitter<void>();
  @Output() abrirAyuda = new EventEmitter<void>();

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }
}