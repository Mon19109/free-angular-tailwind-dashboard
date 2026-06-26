import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-step-liquidacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-liquidacion.component.html',
    styleUrls: ['../../preRegistro.component.css']
})
export class StepLiquidacionComponent {
  @Input() form!: FormGroup;
  @Input() tiposCuenta: string[] = [];
  @Input() beneficiarioIgualComercio = false;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }
}