import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { AppSidebarComponent } from './app-sidebar.component';

describe('Visibilidad de Consulta de Comercios', () => {
  let role: number | string;
  let valid: boolean;
  let perfil: number;
  let modelo: number | string | undefined | null;
  let status: BehaviorSubject<boolean>;
  let component: AppSidebarComponent;
  const paths = (sidebar: AppSidebarComponent) => sidebar.menuSections.flatMap(section => section.items.map(item => item.path));
  beforeEach(() => {
    role = 2; perfil = 9; modelo = 0; valid = true; status = new BehaviorSubject(true);
    spyOn(localStorage, 'getItem').and.returnValue(null);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: {
      authStatus$: status, hasValidSession: () => valid, getUserData: () => ({ idRol: role, idPerfil: perfil, idBusinessModel: modelo })
    } }] });
    const sidebar = { isExpanded$: new BehaviorSubject(true), isMobileOpen$: new BehaviorSubject(false), isHovered$: new BehaviorSubject(false) } as unknown as SidebarService;
    const router = { events: new Subject(), url: '/consulta_comercios' } as unknown as Router;
    const cdr = { detectChanges: () => {} } as ChangeDetectorRef;
    component = TestBed.runInInjectionContext(() => new AppSidebarComponent(sidebar, router, cdr));
    component.ngOnInit();
  });
  afterEach(() => component.ngOnDestroy());
  it('modelo 0 y perfil autenticado 9 ven el módulo y su sección', () => {
    expect(paths(component)).toContain('/consulta_comercios');
    const section = component.menuSections.find(item => item.title === 'GESTIÓN DE NEGOCIO');
    expect(section?.items.map(item => item.path)).toEqual(['/consulta_comercios']);
  });
  it('otros roles no ven Consulta, aunque localStorage afirme rol 2', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue('2');
    for (const other of [0, 1, 7]) {
      role = other; status.next(true);
      expect(paths(component)).not.toContain('/consulta_comercios');
    }
  });
  it('permite roles 2–6 y conserva la condición de modelo 0/perfil 9', () => {
    for (const allowed of [2, 3, 4, 5, 6]) {
      role = allowed; status.next(true);
      expect(paths(component)).toContain('/consulta_comercios');
    }
    perfil = 4; status.next(true);
    expect(paths(component)).not.toContain('/consulta_comercios');
  });
  it('modelos 1–3 no requieren perfil 9; otros modelos no muestran Consulta', () => {
    perfil = 4;
    for (const model of [1, 2, 3, 4]) {
      modelo = model;
      status.next(true);
      expect(paths(component).includes('/consulta_comercios')).toBe(model !== 4);
    }
  });
  it('actualiza Consulta cuando llega /me después de construir el menú', () => {
    modelo = undefined; valid = false; status.next(false);
    expect(paths(component)).not.toContain('/consulta_comercios');
    modelo = 3; role = 3; perfil = 1; valid = true; status.next(true);
    expect(paths(component)).toContain('/consulta_comercios');
    expect(component.menuSections.find(section => section.title === 'GESTIÓN DE NEGOCIO')?.items
      .some(item => item.path === '/consulta_comercios')).toBeTrue();
    modelo = 4; status.next(true);
    expect(paths(component)).not.toContain('/consulta_comercios');
  });
  it('no confunde modelo ausente con cero ni recupera permisos desde storage', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue('3');
    for (const missing of [undefined, null, '', ' ', 'incorrecto']) {
      modelo = missing; status.next(true);
      expect(paths(component)).not.toContain('/consulta_comercios');
    }
    modelo = '3'; role = '3'; perfil = 1; status.next(true);
    expect(paths(component)).toContain('/consulta_comercios');
  });
  it('acepta el rol numérico serializado y reacciona al cierre de sesión', () => {
    role = '2'; status.next(true);
    expect(paths(component)).toContain('/consulta_comercios');
    valid = false; status.next(false);
    expect(paths(component)).not.toContain('/consulta_comercios');
    expect(component.menuSections.some(item => item.title === 'GESTIÓN DE NEGOCIO')).toBeFalse();
  });
});
