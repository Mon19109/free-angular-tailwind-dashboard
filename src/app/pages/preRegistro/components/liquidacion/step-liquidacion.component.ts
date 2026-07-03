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
  @Input() mostrarBeneficiarioIgualComercio = true;
  @Input() textoContinuar = 'Guardar y continuar';
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  get tipoPersonaBeneficiario(): 'fisica' | 'moral' {
    return this.form.get('tipoPersonaBeneficiario')?.value ?? 'fisica';
  }

  get tipoCuenta(): string {
    return this.form.get('tipoCuenta')?.value ?? '';
  }

  get etiquetaCuenta(): string {
    return this.tipoCuenta === 'Tarjeta' ? 'Número de tarjeta' : 'CLABE / número de cuenta';
  }

  get longitudCuenta(): number {
    return this.tipoCuenta === 'Tarjeta' ? 16 : 18;
  }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  mensajeCampo(campo: string): string {
    const control = this.form.get(campo);
    if (control?.hasError('required')) return 'Debes llenar este campo.';
    if (control?.hasError('email')) return 'Ingresa un correo válido.';
    if (control?.hasError('clabeInvalida')) return 'Ingresa una CLABE válida de 18 dígitos.';
    if (control?.hasError('tarjetaInvalida')) return 'Ingresa un número de tarjeta de 16 dígitos.';
    if (control?.hasError('pattern')) return 'El formato no es válido.';
    return 'Debes llenar este campo.';
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }
}
