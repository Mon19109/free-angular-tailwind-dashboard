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
  @Input() datosForm!: FormGroup;
  @Input() niveles: string[] = [];
  @Input() tiposComercio: string[] = [];
  @Input() bloquearNivel = false;
  @Input() bloquearTipoComercio = false;
  @Input() bloquearTipoPersona = false;
  @Input() mostrarTipoPersona = false;
  @Input() ocultarContactoPersonaMoral = false;
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

get esPersonaFisica(): boolean {
  return this.datosForm?.get('tipoPersona')?.value === 'PF';
}

get esPersonaMoral(): boolean {
  return this.datosForm?.get('tipoPersona')?.value === 'PM';
}

get muestraContacto(): boolean {
  return this.esPersonaFisica || (this.mostrarTipoPersona && !(this.ocultarContactoPersonaMoral && this.esPersonaMoral));
}

esContactoInvalido(campo: string): boolean {
  const c = this.datosForm?.get(campo);
  return !!((c?.invalid || this.esCampoAccesoVacio(campo)) && c?.touched);
}

mensajeContacto(campo: string): string {
  const c = this.datosForm?.get(campo);
  if (!c) return 'Campo obligatorio.';
  if (this.esCampoAccesoVacio(campo)) return 'Campo obligatorio.';
  if (c.hasError('required')) return 'Campo obligatorio.';
  if (c.hasError('email')) return 'Ingresa un correo válido.';
  if (c.hasError('pattern') || c.hasError('minlength') || c.hasError('maxlength')) {
    if (campo === 'telefono') return 'Ingresa un teléfono de 10 dígitos.';
  }
  return 'Revisa el dato capturado.';
}

private esCampoAccesoVacio(campo: string): boolean {
  return ['nombreAcceso', 'apellidoPaternoAcceso', 'apellidoMaternoAcceso'].includes(campo)
    && this.muestraContacto
    && !`${this.datosForm?.get(campo)?.value ?? ''}`.trim();
}

  submit(): void {
    const camposDatosPaso = [
      ...(this.mostrarTipoPersona ? ['tipoPersona'] : []),
      ...(this.muestraContacto ? ['nombreAcceso', 'apellidoPaternoAcceso', 'apellidoMaternoAcceso'] : []),
      ...(this.muestraContacto ? ['correo', 'telefono'] : []),
    ];
    const datosPasoInvalidos = camposDatosPaso.some(campo => this.datosForm?.get(campo)?.invalid || this.esCampoAccesoVacio(campo));

    if (this.form.invalid || datosPasoInvalidos) {
      this.form.markAllAsTouched();
      camposDatosPaso.forEach(campo => this.datosForm?.get(campo)?.markAsTouched());
      return;
    }
    this.continuar.emit();
  }
}
