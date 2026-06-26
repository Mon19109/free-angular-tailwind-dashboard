import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-step-comercio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-comercio.component.html',
  styleUrls: ['../../preRegistro.component.css']

  
})
export class StepComercioComponent {
  @Input() form!: FormGroup;
  @Input() niveles: string[] = [];
  @Input() tiposComercio: string[] = [];
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() abrirComisionista = new EventEmitter<void>();

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }


get esSinTipo(): boolean {
  return ['Referenciador', 'Comisionista'].includes(this.form.getRawValue().nivel);
}


  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }
}