import { Component } from '@angular/core';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule,RouterModule,DropdownComponent]
})

export class UserDropdownComponent {
  
  //user: UserSessionData | null = null;

  isOpen = false;
  get userEmail(): string { return this.authService.getUserData().mail || 'USUARIO'; }
  cerrandoSesion = false;
  errorCierre = '';
  get userRole(): string { return this.getRoleName(Number(this.authService.getUserData().idRol)); }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  signOut(event?: Event) {
    event?.preventDefault();
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    this.errorCierre = '';
    this.authService.logout().subscribe({
      next: () => { this.cerrandoSesion = false; this.closeDropdown(); this.router.navigate(['/']); },
      error: () => { this.cerrandoSesion = false; this.errorCierre = 'No fue posible cerrar la sesión. Intenta nuevamente.'; }
    });
  }

  private getRoleName(idRol: number): string {
    const roles: Record<number, string> = {
      2: 'Administrador',
      3: 'Subafiliado',
      4: 'Entidad',
      5: 'Sucursal',
      6: 'Caja',
      7: 'Reserva',
    };

    return roles[idRol] ?? (idRol ? `Rol ${idRol}` : 'Rol no disponible');
  }

  private getBusinessModelName(idBusinessModel: number): string {
    const businessModels: Record<number, string> = {
      1: 'Emisión',
      2: 'Adquirencia',
      3: 'Mixto',
    };

    return businessModels[idBusinessModel] ?? '';
  }
}
