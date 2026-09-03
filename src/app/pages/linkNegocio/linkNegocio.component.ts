import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LinkNegocioService } from '../../services/linkNegocio.service';
import { PaymentHeaderComponent } from '../../shared/layout/payment-header/payment-header.component';

@Component({
  selector: 'app-link-negocio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaymentHeaderComponent],
  templateUrl: './linkNegocio.component.html',
  styleUrl: './linkNegocio.component.css'
})
export class LinkNegocioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly linkNegocioService = inject(LinkNegocioService);

  readonly formulario = this.fb.nonNullable.group({
    emailComer: [''],
    sirio: [''],
    orderingAccount: [''],
    monto: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    concepto: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    apaterno: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    amaterno: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]]
  });

  enviando = false;
  mensajeEstado = '';
  mensajeEsError = false;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.formulario.patchValue({
      emailComer: params.get('email') || '',
      sirio: params.get('validate') || '',
      orderingAccount: params.get('ordering') || ''
    });
  }

  continuar(): void {
    this.mensajeEstado = '';
    this.mensajeEsError = false;
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      this.mensajeEstado = 'Completa correctamente todos los campos obligatorios.';
      this.mensajeEsError = true;
      return;
    }

    if (this.enviando) return;
    this.enviando = true;

    this.linkNegocioService.addLink(this.formulario.getRawValue()).subscribe({
      next: respuesta => {
        this.enviando = false;
        const resultado = respuesta?.rows;

        if (resultado?.success === false) {
          this.mensajeEstado = resultado?.message
            || resultado?.mensaje
            || 'No fue posible generar la solicitud de pago.';
          this.mensajeEsError = true;
          return;
        }

        this.mensajeEstado = resultado?.message
          || resultado?.mensaje
          || 'La solicitud de pago fue generada correctamente.';
      },
      error: error => {
        this.enviando = false;
        this.mensajeEsError = true;
        this.mensajeEstado = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible generar la solicitud de pago.';
      }
    });
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  procesarSoloLetras(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value
      .replace(/[^A-Za-z ]/g, '')
      .replace(/\s{2,}/g, ' ');
    input.value = value;
    this.formulario.controls[input.name as 'concepto' | 'nombre' | 'apaterno' | 'amaterno']
      ?.setValue(value);
  }

  procesarMonto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const soloNumerosYPuntos = input.value.replace(/[^\d.]/g, '');
    const [entero = '', ...decimales] = soloNumerosYPuntos.split('.');
    const tienePunto = soloNumerosYPuntos.includes('.');
    const parteEntera = entero || (tienePunto ? '0' : '');
    const parteDecimal = decimales.join('').slice(0, 2);

    input.value = tienePunto
      ? `${parteEntera}.${parteDecimal}`
      : parteEntera;
    this.formulario.controls.monto.setValue(input.value);
  }

  procesarTelefono(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
    this.formulario.controls.telefono.setValue(input.value);
  }
}
