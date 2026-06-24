import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../services/theme.service';


@Component({
  selector: 'app-theme-toggle-two',
  standalone: true,
  imports: [],
  templateUrl: './theme-toggle-two.component.html',
  styles: ``
})
export class ThemeToggleTwoComponent {
  private readonly themeService = inject(ThemeService);

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
