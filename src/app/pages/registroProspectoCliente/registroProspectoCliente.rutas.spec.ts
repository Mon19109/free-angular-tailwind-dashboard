import { UrlSegment } from '@angular/router';
import { routes, miAngularProspectoMatcher } from '../../app.routes';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Rutas públicas de seguimiento sin SMS', () => {
  it('abre seguimiento sin redirigir al login ni exigir guards de SMS', () => {
    const route = routes.find(route => route.path === 'seguimiento')!;
    expect(route.component).toBe(RegistroProspectoClienteComponent);
    expect(route.redirectTo).toBeUndefined(); expect(route.canActivate).toBeUndefined();
  });
  it('conserva el identificador del enlace para resolverlo en el backend', () => {
    const route = routes.find(route => route.path === 'seguimiento/:link')!;
    expect(route.component).toBe(RegistroProspectoClienteComponent);
    expect(route.canActivate).toBeUndefined();
    const token = 'a'.repeat(100);
    const match = miAngularProspectoMatcher([new UrlSegment('seguimiento', {}), new UrlSegment(token, {})]);
    expect(match?.posParams?.['link'].path).toBe(token);
  });
});
