import { AddBotonPagoComponent } from './addBotonPago.component';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';

describe('AddBotonPagoComponent', () => {
  const keys = ['auth_session', 'user_data', 'sirioId', 'sirioID', 'entitySonID', 'acquiringId', 'mail', 'cuenta'];
  let anteriores: Array<[string, string | null]>;

  beforeEach(() => {
    anteriores = keys.map(key => [key, localStorage.getItem(key)]);
    keys.forEach(key => localStorage.removeItem(key));
  });

  afterEach(() => {
    anteriores.forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
  });

  it('uses the session sirioId as validate and omits isMovil', () => {
    localStorage.setItem('auth_session', JSON.stringify({
      entitySonID: 'SIRIO-123', acquiringId: 'ADQ-999', mail: 'cliente@example.com'
    }));

    const values: Record<string, string> = { entitySonID: 'SIRIO-123', mail: 'cliente@example.com' };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: {
      getSessionValue: (key: string) => values[key] ?? null
    } }] });
    spyOn(localStorage, 'getItem').and.throwError('No consultar storage');
    const component = TestBed.runInInjectionContext(() => new AddBotonPagoComponent());
    component.ngOnInit();
    const params = new URL(component.urlNegocio).searchParams;

    expect(params.get('validate')).toBe('SIRIO-123');
    expect(params.has('isMovil')).toBeFalse();
  });
});
