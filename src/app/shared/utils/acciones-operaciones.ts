/** Acciones disponibles en las vistas PHP de emisión y adquirencia. */
export function accionOperacion(tipo: unknown): { titulo: string; icono: string } | null {
  switch (Number(tipo)) {
    case 10008: return { titulo: 'Detalle de liquidación', icono: 'fa-solid fa-coins' };
    case 1: return { titulo: 'Comprobante SPEI', icono: 'fa-solid fa-file-invoice-dollar' };
    case 4: return { titulo: 'Comprobante de retiro entre cuentas', icono: 'fa-solid fa-file-invoice-dollar' };
    case 10: return { titulo: 'Recarga TAE', icono: 'fa-solid fa-file-invoice-dollar' };
    case 11: return { titulo: 'Pago de servicio', icono: 'fa-solid fa-file-invoice-dollar' };
    default: return null;
  }
}
