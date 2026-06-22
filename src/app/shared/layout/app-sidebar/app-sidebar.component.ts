import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SafeHtmlPipe } from '../../pipe/safe-html.pipe';
import { SidebarWidgetComponent } from './app-sidebar-widget.component';
import { combineLatest, Subscription } from 'rxjs';

type NavItem = {
  name: string;
  icon: string;
  path?: string;
  new?: boolean;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterModule,
    SafeHtmlPipe,
    SidebarWidgetComponent
  ],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {

 panelPrincipalItems: NavItem[] = [
    {
      name: 'PANEL PRINCIPAL',
       icon: '',
      path: '/dashboard'
    }
  ];

  menuSections = [
    {
      title: 'REPORTES',
      items: [
        {
          name: 'REPORTES ADQUIRENCIA',
          icon: '<i class="fas fa-chart-line fa-lg"></i>',
  
          subItems: [
            {
              name: 'Transacciones',
              path: '/transacciones_adquirencia'
            },
            {
              name: 'Operaciones',
              path: '/operaciones_adquirencia'
            }
          ]
        },
        {
          name: 'REPORTES EMISION',
           icon: '<i class="fas fa-chart-pie fa-lg"></i>',
          subItems: [
            {
              name: 'Transacciones',
              path: '/transacciones_emision'
            },
            {
              name: 'Operaciones',
              path: '/operaciones_emision'
            },
            {
              name: 'Tarjeta',
              path: '/tarjeta'
            }
          ]
        },
        {
          name: 'USUARIOS',
           icon: '<i class="fas fa-users fa-lg"></i>',
    
         subItems: [
            {
              name: 'Lista de Usuarios',
               path: "/usuarios"
            }
          ]
         
        },
        {
          name: 'ESTADO DE CUENTA',
           icon: '<i class="fas fa-file-alt fa-lg"></i>',
          path: '/estado_cuenta'
        },
        {
          name: 'SALDOS',
            icon: '<i class="fas fa-dollar-sign fa-lg"></i>',
          path: '/saldos'
        }
      ]
    },

    {
      title: 'PAGOS DIGITALES',
      items: [
        {
          name: 'PAGO A DISTANCIA',
          icon: '<i class="fas fa-link fa-lg"></i>',
          path: '/pago_distancia'
        }
      ]
    },

    {
      title: 'GESTIÓN DE PAGOS',
      items: [
        {
          name: 'ALTAS DE BENEFICIARIO',
          icon: '<i class="fas fa-user-plus fa-lg"></i>',
          path: '/beneficiarios'
        },
        {
          name: 'ENVIOS',
           icon: '<i class="fas fa-exchange-alt fa-lg"></i>',
          path: '/orden_pago'
        }
      ]
    },

    {
      title: 'GESTIÓN DE NEGOCIO',
      items: [
        {
          name: 'ALTA DE COMERCIO',
         icon: '<i class="fas fa-building fa-lg"></i>',
          path: '/alta_comercio'
        },
        {
          name: 'ENTIDAD',
           icon: '<i class="fas fa-store fa-lg"></i>',
          subItems: [
            {
              name: 'Lista Entidades',
              path: '/entidades'
            },
            {
              name: 'Agregar Entidad',
              path: '/entidades_add'
            }
          ]
        },
        {
          name: 'SUCURSAL',
             icon: '<i class="fa-solid fa-cart-shopping fa-lg"></i>',
          subItems: [
            {
              name: 'Lista Sucursales',
              path: '/sucursales'
            },
            {
              name: 'Agregar Sucursal',
              path: '/sucursales_add'
            }
          ]
        },
        {
          name: 'CAJAS',
           icon: '<i class="fas fa-cash-register fa-lg"></i>',
          subItems: [
            {
              name: 'Lista Cajas',
              path: '/cajas'
            },
            {
              name: 'Agregar Caja',
              path: '/cajas_add'
            }
          ]
        },
        {
          name: 'INFORMACION CUENTA',
           icon: '<i class="fas fa-info-circle fa-lg"></i>',
          path: '/informacion_cuenta'
        }
      ]
    },

    {
      title: 'OTROS',
      items: [
        {
          name: 'NOTIFICACIONES',
           icon: '<i class="fas fa-bell fa-lg"></i>',
          path: '/notificaciones'
        },
        {
          name: 'MANUALES',
           icon: '<i class="fas fa-book fa-lg"></i>',
          path: '/manuales'
        },
        {
          name: 'INVITAR COMERCIOS',
         icon: '<i class="fas fa-paper-plane fa-lg"></i>',
          path: '/comercios_invitados'
        }
        
      ]
    }
  ];


  openSubmenu: string | null | number = null;
  subMenuHeights: { [key: string]: number } = {};
  @ViewChildren('subMenu') subMenuRefs!: QueryList<ElementRef>;

  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription: Subscription = new Subscription();

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    // Subscribe to router events
    this.subscription.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.setActiveMenuFromRoute(this.router.url);
        }
      })
    );

    // Subscribe to combined observables to close submenus when all are false
    this.subscription.add(
      combineLatest([this.isExpanded$, this.isMobileOpen$, this.isHovered$]).subscribe(
        ([isExpanded, isMobileOpen, isHovered]) => {
          if (!isExpanded && !isMobileOpen && !isHovered) {
            // this.openSubmenu = null;
            // this.savedSubMenuHeights = { ...this.subMenuHeights };
            // this.subMenuHeights = {};
            this.cdr.detectChanges();
          } else {
            // Restore saved heights when reopening
            // this.subMenuHeights = { ...this.savedSubMenuHeights };
            // this.cdr.detectChanges();
          }
        }
      )
    );

    // Initial load
    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscription.unsubscribe();
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  toggleSubmenu(section: string, index: number) {
    const key = `${section}-${index}`;

    if (this.openSubmenu === key) {
      this.openSubmenu = null;
      this.subMenuHeights[key] = 0;
    } else {
      this.openSubmenu = key;

      setTimeout(() => {
        const el = document.getElementById(key);
        if (el) {
          this.subMenuHeights[key] = el.scrollHeight;
          this.cdr.detectChanges(); // Ensure UI updates
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe(expanded => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {

  this.menuSections.forEach((section: any) => {

    section.items.forEach((nav: any, i: number) => {

      if (nav.subItems) {

        nav.subItems.forEach((subItem: any) => {

          if (currentUrl === subItem.path) {

            const key = `${section.title}-${i}`;

            this.openSubmenu = key;

            setTimeout(() => {

              const el = document.getElementById(key);

              if (el) {
                this.subMenuHeights[key] = el.scrollHeight;
                this.cdr.detectChanges();
              }

            });

          }

        });
 
      }

    });

  });

}

  onSubmenuClick() {
    console.log('click submenu');
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }  

  
}
