export function getSessionRole(): number {
  const storedRole = localStorage.getItem('idRol') ?? localStorage.getItem('IdRol');
  if (storedRole !== null) return Number(storedRole) || 0;

  for (const key of ['auth_session', 'user_data']) {
    try {
      const session = JSON.parse(localStorage.getItem(key) || '{}');
      const role = session?.idRol ?? session?.IdRol;
      if (role !== undefined && role !== null) return Number(role) || 0;
    } catch {
      // Continuar con la siguiente fuente de sesión.
    }
  }
  return 0;
}
