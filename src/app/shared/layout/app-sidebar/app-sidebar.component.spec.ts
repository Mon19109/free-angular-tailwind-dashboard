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
  let status: BehaviorSubject<boolean>;
  let component: AppSidebarComponent;
  const paths = (sidebar: AppSidebarComponent) => sidebar.menuSections.flatMap(section => section.items.map(item => item.path));
  beforeEach(() => {
    role = 2; valid = true; status = new BehaviorSubject(true);
    spyOn(localStorage, 'getItem').and.returnValue(null);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: {
      authStatus$: status, hasValidSession: () => valid, getUserData: () => ({ idRol: role })
    } }] });
    const sidebar = { isExpanded$: new BehaviorSubject(true), isMobileOpen$: new BehaviorSubject(false), isHovered$: new BehaviorSubject(false) } as unknown as SidebarService;
    const router = { events: new Subject(), url: '/consulta_comercios' } as unknown as Router;
    const cdr = { detectChanges: () => {} } as ChangeDetectorRef;
    component = TestBed.runInInjectionContext(() => new AppSidebarComponent(sidebar, router, cdr));
    component.ngOnInit();
  });
  afterEach(() => component.ngOnDestroy());
  it('rol 2 ve el módulo y la sección aun sin modelo/perfil legacy', () => {
    expect(paths(component)).toContain('/consulta_comercios');
    const section = component.menuSections.find(item => item.title === 'GESTIÓN DE NEGOCIO');
    expect(section?.items.map(item => item.path)).toEqual(['/consulta_comercios']);
  });
  it('otros roles no ven Consulta, aunque localStorage afirme rol 2', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue('2');
    for (const other of [0, 1, 3, 4, 5, 6]) {
      role = other; status.next(true);
      expect(paths(component)).not.toContain('/consulta_comercios');
    }
  });
  it('acepta el rol numérico serializado y reacciona al cierre de sesión', () => {
    role = '2'; status.next(true);
    expect(paths(component)).toContain('/consulta_comercios');
    valid = false; status.next(false);
    expect(paths(component)).not.toContain('/consulta_comercios');
    expect(component.menuSections.some(item => item.title === 'GESTIÓN DE NEGOCIO')).toBeFalse();
  });
});
