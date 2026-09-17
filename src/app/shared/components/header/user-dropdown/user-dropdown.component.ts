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
  readonly userEmail = this.getUserEmail();
  readonly userRole = this.getUserRole();

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
    this.closeDropdown();
    this.authService.logout().subscribe({
      next: () => this.finishSignOut(),
      error: () => this.finishSignOut()
    });
  }

  private finishSignOut() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/']);
  }

  private getUserEmail(): string {
    const rawSession = localStorage.getItem('auth_session');

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        return session?.mail || session?.email || localStorage.getItem('mail') || 'USUARIO';
      } catch {
        return localStorage.getItem('mail') || 'USUARIO';
      }
    }

    return localStorage.getItem('mail') || 'USUARIO';
  }

  private getUserRole(): string {
    const session = this.getSessionData();
    const idRol = Number(session?.idRol ?? localStorage.getItem('idRol') ?? 0);
    const idBusinessModel = Number(session?.idBusinessModel ?? localStorage.getItem('idBusinessModel') ?? 0);
    const roleName = this.getRoleName(idRol);
    const typeName = this.getBusinessModelName(idBusinessModel);

    return typeName ? `${roleName} - ${typeName}` : roleName;
  }

  private getSessionData(): any {
    const rawSession = localStorage.getItem('auth_session');

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession);
    } catch {
      return null;
    }
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
