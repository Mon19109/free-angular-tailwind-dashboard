import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { routes } from '../app.routes';
import { AuthService } from '../services/auth.service';
import { SessionTimeoutService } from '../services/session-timeout.service';
import { AuthGuard } from './auth.guard';

describe('Ruta privada Consulta de Comercios', () => {
  const layout = routes.find(route => route.children?.some(child => child.path === 'consulta_comercios'))!;
  const commerce = layout.children!.find(route => route.path === 'consulta_comercios')!;
  it('reutiliza el guard de hijos y permite los roles 2–6', () => {
    expect(layout.canActivateChild).toContain(AuthGuard);
    expect(commerce.data?.['roles']).toEqual([2, 3, 4, 5, 6]);
  });
  for (const [role, authenticated, allowed] of [[2, true, true], [3, true, true], [4, true, true], [5, true, true], [6, true, true], [1, true, false], [7, true, false], [2, false, false]]) {
    it(`rol ${role}, autenticado ${authenticated}: acceso ${allowed}`, () => {
      TestBed.configureTestingModule({ providers: [
        { provide: AuthService, useValue: { validarSesion: () => of({ authenticated, usuario: { idRol: role } }), hasValidSession: () => authenticated } },
        { provide: SessionTimeoutService, useValue: { mostrarModal: () => false } },
        { provide: Router, useValue: { createUrlTree: () => 'login' } }
      ] });
      let result: unknown;
      TestBed.inject(AuthGuard).canActivateChild({ data: commerce.data } as ActivatedRouteSnapshot, {} as RouterStateSnapshot).subscribe(value => result = value);
      expect(result).toBe(allowed ? true : 'login');
    });
  }
});
