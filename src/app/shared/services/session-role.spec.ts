import { AuthService } from '../../services/auth.service';
import { canAddCommerceLevel, canSendCommerceInvitation, getSessionRole } from './session-role';

describe('Permisos de sesión sin storage', () => {
  it('deniega niveles e invitaciones a roles ausentes y desconocidos', () => {
    for (const role of [0, 1, 2, 6, 7, NaN, -1]) {
      expect(canAddCommerceLevel(role)).toBeFalse();
      expect(canSendCommerceInvitation(role)).toBeFalse();
    }
    for (const role of [3, 4, 5]) {
      expect(canAddCommerceLevel(role)).toBeTrue();
      expect(canSendCommerceInvitation(role)).toBeTrue();
    }
  });
  it('obtiene el rol autenticado e ignora almacenamiento manipulado', () => {
    spyOn(localStorage, 'getItem').and.throwError('No leer storage');
    const auth = { getSessionValue: () => '4' } as unknown as AuthService;
    expect(getSessionRole(auth)).toBe(4);
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
});
