// app/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,      // Para ngIf, ngFor, etc.
    ReactiveFormsModule, // Para formGroup, formControlName
    FormsModule,       // Para ngModel si lo usas
    RouterModule       // Para routerLink si lo necesitas
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;

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

  ngOnInit(): void {}

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      let latitud = '';
      let longitud = '';
      
      try {
        const coords = await this.authService.getCurrentLocation();
        latitud = coords.latitud;
        longitud = coords.longitud;
      } catch (locationError) {
        console.warn('No se pudo obtener ubicación:', locationError);
      }

      const credentials = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password,
        latitud: latitud,
        longitud: longitud
      };
      
     // console.log('Coordenadas:', latitud, longitud);

      this.authService.login(credentials).subscribe({
        next: (response: any) => {
          this.loading = false;
          
          if (response.success && response.inSession === 'true') {
            this.router.navigate(['/dashboard']);
          } else {
            this.errorMessage = response.message || 'Error al iniciar sesión';
          }
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.message || 'Error en el servidor';
        }
      });
    } catch (error) {
      this.loading = false;
      this.errorMessage = 'Error al obtener la ubicación';
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
}