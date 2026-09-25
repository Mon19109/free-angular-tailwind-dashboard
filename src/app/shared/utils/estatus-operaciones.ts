/** Equivalencias del catálogo de estatus del PHP de operaciones. */
const ESTATUS_OPERACIONES: Readonly<Record<string, string>> = {
  "5": "Procesando",
  "6": "Denegado",
  "7": "Reversado",
  "8": "Cancelado",
  "10": "Reversando",
  "11": "Devuelto",
  "15": "Aprobado",
  "25": "Creado",
  "26": "Pendiente de envío",
  "27": "Enviado",
  "28": "Rechazado",
  "29": "Confirmado",
  "30": "Conciliado",
  "31": "Liquidado",
  "32": "Cerrado",
  "33": "Tarifa dividida"
};

export function nombreEstatusOperacion(valor: unknown): string {
  const codigo = String(valor ?? '').trim();
  return Object.prototype.hasOwnProperty.call(ESTATUS_OPERACIONES, codigo)
    ? ESTATUS_OPERACIONES[codigo]
    : codigo || 'ND';
}
