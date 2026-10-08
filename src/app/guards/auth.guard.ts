import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionTimeoutService } from '../services/session-timeout.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private authService: AuthService,
    private router: Router,
    private sessionTimeout: SessionTimeoutService
  ) {}

  canActivate(): boolean {
    this.sessionTimeout.validarVencimiento(true);
    if (this.sessionTimeout.mostrarModal()) return false;

    if (this.authService.hasValidSession()) {
      return true;
    }
    
    this.router.navigate(['/']);
    return false;
  }
}