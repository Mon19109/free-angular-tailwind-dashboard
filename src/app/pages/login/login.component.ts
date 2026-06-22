import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormularioModalComponent } from '../../pages/modals/modals.component';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,      // Para ngIf, ngFor, etc.
    ReactiveFormsModule, // Para formGroup, formControlName
    FormsModule,       // Para ngModel si lo usas
    RouterModule,      // Para routerLink si lo necesitas
    FormularioModalComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  showPreregistroModal = false;
  

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    if (this.authService.hasValidSession()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
   /* if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }*/
   if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';


    const { email, password } = this.loginForm.value;

    this.authService.searchAccount(email, password).subscribe({
      next: (result: any) => {
        this.isLoading = false;
        if (result.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = this.getErrorMessage(result.idUser, result.message);
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Error al iniciar sesión';
        console.error('Login error:', error);
      }
    });
  }

  private getErrorMessage(idUser?: string, message?: string): string {
    const errorMap: any = {
      'B': 'Error al obtener el saldo de la cuenta',
      'B-EAU': 'Error al obtener el saldo de la cuenta',
      'L': 'Credenciales incorrectas',
      'L-E-AU': 'Credenciales incorrectas',
      'OA-R': 'Error en el registro del usuario',
      'AU-AU': message || 'Error en autenticación',
      'PROCESSING': 'Ya hay una petición en proceso'
    };

    return errorMap[idUser || ''] || message || 'Error al iniciar sesión';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  modalPreregistro(event?: Event): void {
    event?.preventDefault();
    this.showPreregistroModal = true;
  }

  /*togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }*/

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}
