import { Component, ElementRef, ViewChild } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeToggleButtonComponent } from '../../components/common/theme-toggle/theme-toggle-button.component';
import { NotificationDropdownComponent } from '../../components/header/notification-dropdown/notification-dropdown.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';



@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    RouterModule,
    ThemeToggleButtonComponent,
    NotificationDropdownComponent,
    UserDropdownComponent,
  ],
  templateUrl: './app-header.component.html',
})

export class AppHeaderComponent {


  isApplicationMenuOpen = false;
  readonly isMobileOpen$;

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;


tituloPagina = '';
private readonly titulosPaginas: Record<string, string> = {
  dashboard: 'Panel Principal',
  saldos: 'Detalle de saldo',
  usuarios: 'Usuarios',
  transacciones_adquirencia: 'Transacciones',
  operaciones_adquirencia: 'Operaciones',
  transacciones_emision: 'Transacciones',
  operaciones_emision: 'Operaciones',
  tarjeta: 'Tarjeta',
  pago_distancia: 'Pago a Distancia',

  // futuros módulos
  reportes: 'Reportes',
  conciliacion: 'Conciliación',
  comercios: 'Comercios',
  cuentas: 'Cuentas'
};

constructor(
  public sidebarService: SidebarService,
  private router: Router
) {

  this.isMobileOpen$ = this.sidebarService.isMobileOpen$;

  this.router.events
    .pipe(
      filter(event => event instanceof NavigationEnd)
    )
   .subscribe(() => {

  const url = this.router.url;

  const rutaEncontrada =
    Object.keys(this.titulosPaginas)
      .find(ruta => url.includes(ruta));

  this.tituloPagina =
    rutaEncontrada
      ? this.titulosPaginas[rutaEncontrada]
      : '';

});
}


  handleToggle() {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  toggleApplicationMenu() {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }

  ngAfterViewInit() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  };
}
