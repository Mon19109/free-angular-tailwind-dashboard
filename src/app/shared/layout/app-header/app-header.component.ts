import { Component, ElementRef, ViewChild } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeToggleButtonComponent } from '../../components/common/theme-toggle/theme-toggle-button.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';



@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ThemeToggleButtonComponent,
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
  orden_pago: 'Gestion de Pago',
  revision_mesa_digital: 'Revisión de Mesa Digital',
  enviar_invitacion_comercio: 'Enviar Invitación a Comercio',
  beneficiarios: 'Beneficiarios',
  manuales: 'Manuales',
  informacion_cuenta: 'Información de cuenta',
  sucursales: 'Lista Sucursales',
  cajas: 'Lista Cajas',
  estado_cuenta: 'Estado de Cuenta',
  consulta_comercios: 'Consulta de Comercios',
  registro_cliente: 'Registro de Cliente / Comercio',
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
