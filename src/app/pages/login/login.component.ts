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
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = this.getErrorMessage(result.idUser, result.message);
          console.error('Login error3:', this.errorMessage);

        }
      },
      error: (error: any) => {
        if (error.status == 401) {
          //this.router.navigate(['/dashboard']);
          console.log('error---',error);

        } else {
          /*this.errorMessage = this.getErrorMessage(result.idUser, result.message);
          console.error('Login error3:', this.errorMessage);*/
          this.isLoading = false;
          this.loading = false;
          this.errorMessage = error.message || 'Error al iniciar sesión2';
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
