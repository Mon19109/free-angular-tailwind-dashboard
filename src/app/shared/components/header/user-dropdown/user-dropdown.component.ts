import { Component } from '@angular/core';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { DropdownItemTwoComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component-two';

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule,RouterModule,DropdownComponent,DropdownItemTwoComponent]
})

export class UserDropdownComponent {
  
  //user: UserSessionData | null = null;

  isOpen = false;

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
}
