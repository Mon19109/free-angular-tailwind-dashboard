import { obtenerNodoSesion } from './nodo-sesion';

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
    expect(obtenerNodoSesion()).toBe('83');
  });
  it('conserva el nodo legacy cuando no existe sesión nueva', () => {
    localStorage.removeItem('auth_session');
    localStorage.setItem('nodeID', '84');
    expect(obtenerNodoSesion()).toBe('84');
  });
  it('respeta el cero si procede de la sesión actual', () => {
    localStorage.setItem('auth_session', JSON.stringify({ nodeID: 0 }));
    localStorage.setItem('nodeID', '84');
    expect(obtenerNodoSesion()).toBe('0');
  });
});
