import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { authGuard } from './auth-guard';
import { AuthGuard } from './auth.guard';
import { agregarNivelComercioGuard } from './agregar-nivel-comercio.guard';
import { enviarInvitacionComercioGuard } from './enviar-invitacion-comercio.guard';

describe('AuthGuard con BFF', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), {
      provide: Router, useValue: { events: new Subject(), routerState: { snapshot: { root: {} } }, createUrlTree: () => 'login' }
    }] }); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  for (const authenticated of [false, true]) {
    it(`valida /me y ${authenticated ? 'permite' : 'bloquea'} la sesión`, () => {
      let result: unknown;
      TestBed.inject(AuthGuard).canActivate({ data: {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot).subscribe(value => result = value);
      http.expectOne('/api/auth/me').flush({ success: authenticated, authenticated, expiresAt: Date.now() + 600000, usuario: { idRol: 2 } });
      expect(result).toBe(authenticated ? true : 'login');
    });
  }
  it('aplica roles también al guard de hijos', () => {
    let result: unknown;
    TestBed.inject(AuthGuard).canActivateChild({ data: { roles: [2] } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot).subscribe(value => result = value);
    http.expectOne('/api/auth/me').flush({ success: true, authenticated: true, expiresAt: Date.now() + 600000, usuario: { idRol: 3 } });
    expect(result).toBe('login');
  });
  it('el guard funcional delega y deniega cuando /me falla', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({ data: {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as import('rxjs').Observable<unknown>;
    let decision: unknown; result.subscribe(value => decision = value);
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(decision).toBe('login');
  });
  for (const guard of [agregarNivelComercioGuard, enviarInvitacionComercioGuard]) {
    for (const role of [0, 2, 3, 6, 99]) {
      it(`resuelve permisos con /me al entrar directamente, rol ${role}`, () => {
        spyOn(localStorage, 'getItem').and.throwError('No consultar almacenamiento');
        const result = TestBed.runInInjectionContext(() => guard({ data: {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as import('rxjs').Observable<unknown>;
        let decision: unknown;
        result.subscribe(value => decision = value);
        expect(decision).toBeUndefined();
        http.expectOne('/api/auth/me').flush({ success: true, authenticated: true, expiresAt: Date.now() + 600000, usuario: { idRol: role } });
        expect(decision).toBe(role === 3 ? true : 'login');
        expect(localStorage.getItem).not.toHaveBeenCalled();
      });
    }
  }
});
