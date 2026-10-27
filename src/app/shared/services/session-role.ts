import { AuthService } from '../../services/auth.service';

export function canSendCommerceInvitation(role: number): boolean {
  return [3, 4, 5].includes(role);
}

export function canAddCommerceLevel(role: number): boolean {
  return [3, 4, 5].includes(role);
}

export function getSessionRole(auth: AuthService): number {
  return Number(auth.getSessionValue('idRol')) || 0;
}
