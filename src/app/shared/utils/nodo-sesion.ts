/** Usa el nodo de la sesión actual antes que la copia legacy. */
export function obtenerNodoSesion(): string {
  const rawSession = localStorage.getItem('auth_session');
  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      if (session?.nodeID !== null && session?.nodeID !== undefined) {
        return String(session.nodeID).trim();
      }
    } catch {
      // Compatibilidad con sesiones antiguas sin JSON válido.
    }
  }
  return localStorage.getItem('nodeID')?.trim() || '';
}
