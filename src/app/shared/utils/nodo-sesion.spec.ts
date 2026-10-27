import { obtenerNodoSesion } from './nodo-sesion';
import { AuthService } from '../../services/auth.service';

describe('Nodo de sesión', () => {
  let anteriores: Array<[string, string | null]>;
  beforeEach(() => {
    anteriores = ['auth_session', 'nodeID'].map(key => [key, localStorage.getItem(key)]);
  });
  afterEach(() => anteriores.forEach(([key, value]) => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }));
  it('prioriza el nodo de sesión sobre un cero legacy', () => {
    localStorage.setItem('auth_session', JSON.stringify({ nodeID: 83 }));
    localStorage.setItem('nodeID', '0');
    const auth = { getSessionValue: () => '83' } as unknown as AuthService;
    expect(obtenerNodoSesion(auth)).toBe('83');
  });
  it('ignora el nodo legacy cuando no existe en la sesión validada', () => {
    localStorage.removeItem('auth_session');
    localStorage.setItem('nodeID', '84');
    const auth = { getSessionValue: () => null } as unknown as AuthService;
    expect(obtenerNodoSesion(auth)).toBe('');
  });
  it('respeta el cero si procede de la sesión actual', () => {
    localStorage.setItem('auth_session', JSON.stringify({ nodeID: 0 }));
    localStorage.setItem('nodeID', '84');
    const auth = { getSessionValue: () => '0' } as unknown as AuthService;
    expect(obtenerNodoSesion(auth)).toBe('0');
  });
});
