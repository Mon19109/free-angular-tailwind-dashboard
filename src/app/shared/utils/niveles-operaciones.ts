/** El árbol puede incluir la raíz y descendientes de distintos niveles. */
export function nodosDelNivel(response: unknown, nivel: number): any[] {
  const resultado: any[] = [];
  const ids = new Set<string>();
  const visitar = (valor: any): void => {
    if (Array.isArray(valor)) { valor.forEach(visitar); return; }
    if (!valor || typeof valor !== 'object') return;
    const id = valor.idNode ?? valor.nodeID ?? valor.nodeId ?? valor.idEntity
      ?? valor.idTerminal ?? valor.idTerminalUser ?? valor.affiliationId ?? valor.id;
    const hijos = ['children', 'childs', 'nodes', 'tree', 'rows', 'contextResponse', 'data', 'content']
      .map(key => valor[key]).filter(item => item && typeof item === 'object');
    const nivelApi = valor.levelType ?? valor.idAffilationLevel ?? valor.level;
    const texto = String(nivelApi ?? '').toUpperCase();
    const nivelNodo = Number(nivelApi) || (texto.includes('SUB') ? 3
      : texto.includes('ENTIDAD') ? 4 : texto.includes('SUCURSAL') ? 5
      : texto.includes('CAJA') ? 6 : 0);
    // Las respuestas planas antiguas ya vienen filtradas por el endpoint.
    if (id != null && (nivelNodo === nivel || (!nivelNodo && !hijos.length)) && !ids.has(String(id))) {
      ids.add(String(id));
      resultado.push(valor);
    }
    hijos.forEach(visitar);
  };
  visitar(response);
  return resultado;
}
