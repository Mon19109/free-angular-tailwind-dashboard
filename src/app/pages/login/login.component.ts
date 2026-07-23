import { Component, OnInit, ViewContainerRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GeolocationService } from '../../services/geolocation.service';
import { NgxTailwindModalService } from '@dotted-labs/ngx-tailwind-modal';
import { FormularioModalComponent } from '../../pages/modals/modals.component';

@Component({
  selector: 'app-login',
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
  isLoading = false;
  errorMessage = '';
  lat = '';
  lon = '';
  showPassword = false;
  loading = false;
  userLocation: any;
  showTokenModal = false;
  tokenValue = '';
  telModal = '';

  private modalService = inject( NgxTailwindModalService);
  private vcr = inject(ViewContainerRef);
  

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private geolocationService: GeolocationService
  ) {
    this.loginForm = this.fb.group({
      userLogin: ['', [Validators.required, Validators.email]],
      passwordLogin: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async ngOnInit() {
    if (this.authService.hasValidSession()) {
      this.router.navigate(['/dashboard']);
    }
    try {
      this.userLocation = await this.geolocationService.getCurrentLocation();

      console.log('Latitud:', this.userLocation.latitude);
      console.log('Longitud:', this.userLocation.longitude);
      this.lat = this.userLocation.latitude;
      this.lon = this.userLocation.longitude;

      // Guardar en localStorage si lo necesitas
      localStorage.setItem(
        'location',
        JSON.stringify(this.userLocation)
      );

    } catch (error) {
      console.error(error);
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
    this.executeLogin();
    /*this.errorMessage = '';
    this.tokenValue = '';*/
    this.showTokenModal = false;
  }

  closeTokenModal(): void {
    if (this.loading) {
      return;
    }

    this.showTokenModal = false;
    this.tokenValue = '';
  }

  validateToken(): void {
    this.showTokenModal = false;
    this.executeToken();
  }

  private executeToken(): void {

    this.authService.validateSmsToken(this.tokenValue).subscribe({
      next: (result: any) => {
        this.isLoading = false;
        this.loading = false;

        if (result.success) {
          this.router.navigate(['/dashboard']);
          this.errorMessage = '';
          this.tokenValue = '';
          this.showTokenModal = false;
        } else {
          this.errorMessage = this.getErrorMessage(result.idUser, result.message);
          console.error('Token error3:', this.errorMessage);

        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.loading = false;

        if (error.status == 401) {
          this.errorMessage = 'Correo o contraseña incorrectos.';
          console.error('Token error:', error);
        } else {
          this.errorMessage = error.message || 'No fue posible iniciar sesión. Verifica tus datos e intenta nuevamente.';
          console.error('Token error:', error);
          console.error('Token error2:', error.message);

        }
        
      }
    });

  }
  private executeLogin(): void {
    this.isLoading = true;
    this.loading = true;
    this.errorMessage = '';


    const { userLogin, passwordLogin } = this.loginForm.value;
    const latitud = this.lat || '0';
    const longitud = this.lon || '0';

    this.authService.searchAccount(userLogin, passwordLogin, latitud, longitud).subscribe({
      next: (result: any) => {
        this.isLoading = false;
        this.loading = false;

        if (result.success) {
          //this.router.navigate(['/dashboard']);
          this.errorMessage = '';
          this.tokenValue = '';
          this.telModal = result.oft ?? '??';
          console.log('TEEEEL :::',this.telModal);
          this.showTokenModal = true;
        } else {
          this.errorMessage = this.getErrorMessage(result.idUser, result.message);
          console.error('Login error3:', this.errorMessage);

        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.loading = false;

        if (error.status == 401) {
          this.errorMessage = 'Correo o contraseña incorrectos.';
          console.error('Login error:', error);
        } else {
          this.errorMessage = error.message || 'No fue posible iniciar sesión. Verifica tus datos e intenta nuevamente.';
          console.error('Login error:', error);
          console.error('Login error2:', error.message);

        }
        
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

    console.log('idUser:',idUser);
    console.log('message:',message);
    console.log('errorMap:',errorMap);

    return errorMap[idUser || ''] || message || 'Error al iniciar sesión1';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  modalPreregistro() {
    if (event) {
        event.preventDefault();
      }
    this.modalService
      .create('formulario-modal', FormularioModalComponent)
      .setData({ titulo: 'Formulario de contacto' })
      .open();
  }

  /*togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }*/

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}
