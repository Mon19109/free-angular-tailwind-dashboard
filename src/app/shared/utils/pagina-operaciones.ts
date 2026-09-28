export function leerPaginaOperaciones(response: any, pagina: number) {
  const body = response?.response ?? response?.rows ?? response;
  const datos = Array.isArray(body) ? body : body?.operations ?? body?.content ?? [];
  const operaciones = Array.isArray(datos) ? datos : [];
  const valorTotal = body?.totalItems ?? body?.totalElements ?? response?.totalItems ?? response?.totalElements;
  const total = valorTotal === undefined || valorTotal === null ? null : Number(valorTotal);
  return {
    operaciones,
    total: total !== null && Number.isFinite(total) ? total : null,
    siguiente: total !== null && Number.isFinite(total)
      ? pagina * 10 < total : operaciones.length === 10
  };
}
