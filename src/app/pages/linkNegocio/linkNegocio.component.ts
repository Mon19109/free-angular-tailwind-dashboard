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
  cargandoNegocio = false;
  negocioCargado = false;
  nombreComercio = 'Comercio Kashpay';
  telefonoComercio = 'Información de contacto';
  mensajeEstado = '';
  mensajeEsError = false;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const sirioId = String(params.get('validate') || '').trim();
    this.formulario.controls.sirio.setValue(sirioId);

    if (!sirioId) {
      this.mensajeEstado = 'El link de negocio no contiene un identificador válido.';
      this.mensajeEsError = true;
      return;
    }

    this.consultarNegocio(sirioId);
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

    if (this.enviando || !this.negocioCargado) return;
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

        if (resultado?.success === true) {
          const formUrl = String(resultado?.payOrderResponse?.formUrl || '').trim();
          const referencia = this.obtenerReferencia(formUrl);

          if (referencia) {
            const paymentUrl = new URL('paymentLink', document.baseURI);
            paymentUrl.searchParams.set('reference', referencia);
            window.location.assign(paymentUrl.toString());
            return;
          }

          this.mensajeEstado = 'La solicitud fue generada, pero la respuesta no contiene una referencia de pago válida.';
          this.mensajeEsError = true;
          return;
        }

        this.mensajeEstado = resultado?.message
          || resultado?.mensaje
          || 'La respuesta del servicio no pudo ser procesada.';
        this.mensajeEsError = true;
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

  private obtenerReferencia(formUrl: string): string {
    if (!formUrl) return '';

    try {
      const url = new URL(formUrl, document.baseURI);
      return String(url.searchParams.get('reference') || '').trim();
    } catch {
      const [, referencia = ''] = formUrl.split('?reference=');
      return referencia.split('&')[0].trim();
    }
  }

  private consultarNegocio(sirioId: string): void {
    this.cargandoNegocio = true;
    this.linkNegocioService.obtenerNegocio(sirioId).subscribe({
      next: respuesta => {
        this.cargandoNegocio = false;

        if (respuesta?.success === false) {
          this.mostrarErrorNegocio(respuesta?.message || respuesta?.mensaje);
          return;
        }

        const negocio = this.obtenerDatosNegocio(respuesta);
        if (!negocio) {
          this.mostrarErrorNegocio('No se encontró información para este link de negocio.');
          return;
        }

        const nombrePersona = [
          this.obtenerTextoValido(negocio, ['name']),
          this.obtenerTextoValido(negocio, ['paternalSurname']),
          this.obtenerTextoValido(negocio, ['maternalSurname'])
        ].filter(Boolean).join(' ');

        this.nombreComercio = nombrePersona || this.obtenerTextoValido(negocio, [
          'nameCommerce', 'commercialName', 'commerceName', 'businessName',
          'bussinesName', 'nombre', 'razonSocial'
        ]) || this.nombreComercio;
        this.telefonoComercio = this.obtenerTexto(negocio, [
          'phoneNumber', 'telephoneNumber', 'phone', 'telefono', 'telephone'
        ]) || this.telefonoComercio;

        this.formulario.patchValue({
          emailComer: this.obtenerTexto(negocio, [
            'email', 'commerceEmail', 'businessEmail', 'emailCommerce', 'correo'
          ]),
          orderingAccount: this.obtenerTexto(negocio, [
            'orderingAccount', 'account', 'accountNumber', 'cuenta', 'clabe'
          ]),
          sirio: this.obtenerTexto(negocio, ['sirioId', 'sirioID']) || sirioId
        });
        this.negocioCargado = true;
      },
      error: error => {
        this.cargandoNegocio = false;
        this.mostrarErrorNegocio(
          error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible consultar la información del negocio.'
        );
      }
    });
  }

  private obtenerDatosNegocio(respuesta: unknown): Record<string, unknown> | null {
    if (!respuesta || typeof respuesta !== 'object') return null;

    const raiz = respuesta as Record<string, unknown>;
    const candidatos = [
      raiz['row'], raiz['rows'], raiz['data'], raiz['business'], raiz['commerce'], raiz
    ];

    for (const candidato of candidatos) {
      const valor = Array.isArray(candidato) ? candidato[0] : candidato;
      if (valor && typeof valor === 'object') return valor as Record<string, unknown>;
    }

    return null;
  }

  private obtenerTexto(datos: Record<string, unknown>, llaves: string[]): string {
    for (const llave of llaves) {
      const valor = datos[llave];
      if (valor !== undefined && valor !== null && String(valor).trim()) {
        return String(valor).trim();
      }
    }

    return '';
  }

  private obtenerTextoValido(datos: Record<string, unknown>, llaves: string[]): string {
    const valor = this.obtenerTexto(datos, llaves);
    return valor.toUpperCase() === 'NA' ? '' : valor;
  }

  private mostrarErrorNegocio(mensaje?: string): void {
    this.negocioCargado = false;
    this.mensajeEstado = mensaje || 'No fue posible consultar la información del negocio.';
    this.mensajeEsError = true;
  }
}
