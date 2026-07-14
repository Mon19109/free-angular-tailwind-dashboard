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
}
