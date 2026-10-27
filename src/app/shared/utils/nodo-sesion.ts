import { AuthService } from '../../services/auth.service';

/** Lee el nodo exclusivamente de la sesión confirmada por el servidor. */
export function obtenerNodoSesion(auth: AuthService): string {
  return auth.getSessionValue('nodeID')?.trim() || '';
}
