import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

@Component({
  selector: 'app-recuperar-cuenta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './recuperarCuenta.component.html',
  styleUrls: ['../login/login.component.css', './recuperarCuenta.component.css']
})
export class RecuperarCuentaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly recuperarCuentaService = inject(RecuperarCuentaService);

  readonly recuperarForm = this.fb.nonNullable.group({
    info: ['', Validators.required],
    contrasena: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
    contrasenaCon: ['', Validators.required]
  }, { validators: confirmarContrasenas });

  mostrarContrasena = false;
  mostrarConfirmacion = false;
  enviando = false;
  mensajeEstado = '';
  mensajeEsError = false;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('validate')
      || this.route.snapshot.queryParamMap.get('guid')
      || '';
    this.recuperarForm.controls.info.setValue(token);
  }

  get requisitos(): Array<{ texto: string; cumplido: boolean }> {
    const value = this.recuperarForm.controls.contrasena.value;
    return [
      { texto: 'Al menos 12 caracteres', cumplido: value.length >= 12 },
      { texto: 'Letras minúsculas', cumplido: /[a-z]/.test(value) },
      { texto: 'Letras mayúsculas', cumplido: /[A-Z]/.test(value) },
      { texto: 'Números', cumplido: /\d/.test(value) },
      { texto: 'Caracteres especiales aceptados $@!%*?&', cumplido: /[@$!%*?&]/.test(value) }
    ];
  }

  get nivelSeguridad(): string {
    const total = this.requisitos.filter(requisito => requisito.cumplido).length;
    if (total === 5) return 'Muy segura';
    if (total >= 3) return 'Poco segura';
    return 'Muy insegura';
  }

  get claseSeguridad(): string {
    if (this.nivelSeguridad === 'Muy segura') return 'secure';
    if (this.nivelSeguridad === 'Poco segura') return 'medium';
    return 'weak';
  }

  procesarContrasena(event: Event, field: 'contrasena' | 'contrasenaCon'): void {
    const input = event.target as HTMLInputElement;
    const value = Array.from(input.value)
      .filter(character => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&'.includes(character))
      .join('');
    input.value = value;
    this.recuperarForm.controls[field].setValue(value);
  }

  recuperarCuenta(): void {
    this.mensajeEstado = '';
    this.mensajeEsError = false;
    this.recuperarForm.markAllAsTouched();

    if (this.recuperarForm.invalid) {
      this.mensajeEstado = this.recuperarForm.controls.info.invalid
        ? 'El enlace de recuperación no contiene un token válido.'
        : 'La contraseña debe cumplir todos los requisitos y ambas contraseñas deben coincidir.';
      this.mensajeEsError = true;
      return;
    }

    this.enviando = true;
    const values = this.recuperarForm.getRawValue();

    this.recuperarCuentaService.recuperarCuenta({
      guid: values.info,
      nueva: values.contrasena
    }).pipe(
      finalize(() => this.enviando = false)
    ).subscribe({
      next: response => {
        if (response?.success === false) {
          this.mensajeEstado = response?.message || response?.mensaje || 'No fue posible recuperar la cuenta.';
          this.mensajeEsError = true;
          return;
        }

        this.mensajeEstado = response?.message
          || response?.mensaje
          || 'La contraseña fue actualizada correctamente. Ya puedes iniciar sesión.';
        this.recuperarForm.controls.contrasena.reset();
        this.recuperarForm.controls.contrasenaCon.reset();
      },
      error: error => {
        this.mensajeEstado = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible recuperar la cuenta.';
        this.mensajeEsError = true;
      }
    });
  }
}

function confirmarContrasenas(control: AbstractControl): ValidationErrors | null {
  const password = control.get('contrasena')?.value;
  const confirmation = control.get('contrasenaCon')?.value;
  return password && confirmation && password !== confirmation
    ? { passwordsMismatch: true }
    : null;
}
