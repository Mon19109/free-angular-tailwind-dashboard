import { Component, OnInit, ViewContainerRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GeolocationService } from '../../services/geolocation.service';
import { NgxTailwindModalService } from '@dotted-labs/ngx-tailwind-modal';
import { FormularioModalComponent } from '../../pages/modals/modals.component';
import { finalize, switchMap, tap } from 'rxjs/operators';

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
  ip = '';
  errorIp = false;
  showPassword = false;
  loading = false;
  userLocation: any;
  private ubicacionPendiente?: Promise<boolean>;
  showTokenModal = false;
  tokenValue = '';
  tokenErrorMessage = '';
  mostrarReenvioToken = false;
  telModal = '';
  showRecoveryModal = false;
  recovering = false;
  recoveryMessage = '';
  recoveryMessageIsError = false;
  recoveryForm: FormGroup;

  private modalService = inject( NgxTailwindModalService);
  private vcr = inject(ViewContainerRef);
  

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private geolocationService: GeolocationService
  ) {
    this.loginForm = this.fb.group({
      userLogin: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      passwordLogin: ['', [Validators.required, Validators.maxLength(20)]]
    });
    this.recoveryForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]]
    });
  }

  async ngOnInit() {
    const prospectId = this.route.snapshot.queryParamMap.get('prospectId')
      || this.route.snapshot.queryParamMap.get('prospect')
      || this.route.snapshot.queryParamMap.get('id')
      || '';
    const link = this.route.snapshot.queryParamMap.get('link') || '';

    if (prospectId && link) {
      this.router.navigate(['/registro-prospecto', link], {
        queryParams: { prospectId },
        replaceUrl: true
      });
      return;
    }

    if (this.authService.hasValidSession()) {
      this.router.navigate(['/dashboard']);
    }
    this.authService.obtenerIp().subscribe({
      next: ip => { this.ip = ip; this.errorIp = false; },
      error: () => { this.errorIp = true; }
    });
    await this.obtenerUbicacionParaLogin();
  }

  private obtenerUbicacionParaLogin(): Promise<boolean> {
    if (this.ubicacionPendiente) return this.ubicacionPendiente;
    this.ubicacionPendiente = this.geolocationService.getCurrentLocation()
      .then(location => {
        if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
          throw new Error('Ubicación inválida');
        }
        this.userLocation = location;
        this.lat = String(location.latitude);
        this.lon = String(location.longitude);
        localStorage.setItem('location', JSON.stringify(location));
        return true;
      })
      .catch(() => {
        this.userLocation = undefined;
        this.lat = '';
        this.lon = '';
        localStorage.removeItem('location');
        this.errorMessage = 'Para iniciar sesión, permite el acceso a tu ubicación en el navegador. Si ya lo permitiste, verifica que la ubicación esté disponible e intenta de nuevo.';
        return false;
      })
      .finally(() => { this.ubicacionPendiente = undefined; });
    return this.ubicacionPendiente;
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
    this.tokenErrorMessage = '';
    this.mostrarReenvioToken = false;
  }

  validateToken(): void {
    if (this.loading) return;
    if (this.mostrarReenvioToken) {
      this.executeLogin(true);
      return;
    }
    if (!this.tokenValue.trim()) {
      this.tokenErrorMessage = 'Ingrese código';
      return;
    }
    if (this.tokenValue.length > 8) {
      this.tokenErrorMessage = 'Código incorrecto';
      this.mostrarReenvioToken = true;
      return;
    }

    this.executeToken();
  }

  clearTokenError(): void {
    this.tokenErrorMessage = '';
    this.mostrarReenvioToken = false;
  }

  private executeToken(): void {
    this.isLoading = true;
    this.loading = true;
    this.tokenErrorMessage = '';

    this.authService.validateSmsToken(this.tokenValue).pipe(
      finalize(() => {
        this.isLoading = false;
        this.loading = false;
      })
    ).subscribe({
      next: (result: any) => {
        if (result.success) {
          this.authService.completeSmsValidation();
          this.router.navigate(['/dashboard']);
          this.errorMessage = '';
          this.tokenValue = '';
          this.tokenErrorMessage = '';
          this.mostrarReenvioToken = false;
          this.showTokenModal = false;
        } else {
          this.showTokenModal = true;
          this.tokenErrorMessage = 'Código incorrecto';
          this.mostrarReenvioToken = true;
          console.error('Token error3:', this.getErrorMessage(result.idUser, result.message));

        }
      },
      error: (error: any) => {
        this.showTokenModal = true;
        this.tokenErrorMessage = 'Código incorrecto';
        this.mostrarReenvioToken = true;
        console.error('Token error:', error);
        
      }
    });

  }
  private async executeLogin(esReenvio = false): Promise<void> {
    if (this.loading) return;
    this.isLoading = true;
    this.loading = true;
    this.errorMessage = '';
    if (esReenvio) this.tokenErrorMessage = '';


    const { userLogin, passwordLogin } = this.loginForm.value;
    if (!await this.obtenerUbicacionParaLogin()) {
      if (esReenvio) this.tokenErrorMessage = this.errorMessage;
      this.isLoading = false;
      this.loading = false;
      return;
    }
    const latitud = this.lat;
    const longitud = this.lon;

    this.authService.obtenerIp().pipe(
      tap({
        next: ip => { this.ip = ip; this.errorIp = false; },
        error: () => { this.errorIp = true; }
      }),
      switchMap(() => this.authService.searchAccount(userLogin, passwordLogin, latitud, longitud)),
      finalize(() => {
        this.isLoading = false;
        this.loading = false;
      })
    ).subscribe({
      next: (result: any) => {
        if (result.success) {
          //this.router.navigate(['/dashboard']);
          this.errorMessage = '';
          this.tokenValue = '';
          this.tokenErrorMessage = '';
          this.mostrarReenvioToken = false;
          this.telModal = result.oft ?? '??';
          this.showTokenModal = true;
        } else {
          this.errorMessage = this.getErrorMessage(result.idUser, result.message);
          if (esReenvio) this.tokenErrorMessage = this.errorMessage;
          console.error('Login error3:', this.errorMessage);

        }
      },
      error: (error: any) => {
        if (error.status === 0) {
          this.errorMessage = 'No se ha podido establecer conexión con el servidor.';
          console.error('Login error:', error);
        } else if (error.status == 401) {
          this.errorMessage = 'Correo o contraseña incorrectos.';
          console.error('Login error:', error);
        } else {
          this.errorMessage = error.message || 'No fue posible iniciar sesión. Verifica tus datos e intenta nuevamente.';
          console.error('Login error:', error);
          console.error('Login error2:', error.message);

        }
        if (esReenvio) this.tokenErrorMessage = this.errorMessage;
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

    return errorMap[idUser || ''] || message || 'Error al iniciar sesión1';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  openRecoveryModal(): void {
    const loginEmail = String(this.loginForm.controls['userLogin'].value || '').trim();
    this.recoveryForm.reset({ email: loginEmail });
    this.recoveryMessage = '';
    this.recoveryMessageIsError = false;
    this.showRecoveryModal = true;
  }

  closeRecoveryModal(): void {
    if (this.recovering) return;
    this.showRecoveryModal = false;
    this.recoveryForm.reset();
    this.recoveryMessage = '';
    this.recoveryMessageIsError = false;
  }

  recoverAccount(): void {
    this.recoveryForm.markAllAsTouched();
    if (this.recoveryForm.invalid || this.recovering) return;

    const email = String(this.recoveryForm.controls['email'].value || '').trim();
    this.recovering = true;
    this.recoveryMessage = '';
    this.recoveryMessageIsError = false;

    this.authService.forgotPassword(email).pipe(
      finalize(() => this.recovering = false)
    ).subscribe({
      next: (response: any) => {
        if (response?.success === false) {
          this.recoveryMessage = response?.message || 'No fue posible recuperar la cuenta.';
          this.recoveryMessageIsError = true;
          return;
        }

        this.recoveryMessage = response?.message
          || 'Se enviaron las instrucciones de recuperación a tu correo.';
      },
      error: (error: any) => {
        this.recoveryMessage = error?.status === 409
          ? 'El correo ingresado no existe en el ambiente de Kashpay.'
          : error?.error?.message
          || error?.message
          || 'No fue posible recuperar la cuenta.';
        this.recoveryMessageIsError = true;
      }
    });
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
