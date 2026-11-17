import { DocumentoRequerido } from '../../pages/preRegistro/models/preregistro.models';

// Continúa el catálogo existente (1–15). Debe coincidir con el contrato del BFF.
export const DOCUMENTOS_ADICIONALES = [
  { numero: 16, nombre: 'CARTA OPINIÓN CUMPLIMIENTO', obligatorio: false, sufijo: 'CARTA_OPINION', extension: 'pdf', mime: 'application/pdf' },
{ numero: 17, nombre: 'CATÁLOGO DE COSTOS', obligatorio: false, sufijo: 'CAT_COSTOS', extension: 'xlsm', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
{ numero: 18, nombre: 'EVIDENCIA ADICIONAL PARA PLD', obligatorio: false, sufijo: 'EV_ADI_PLD', extension: 'pdf', mime: 'application/pdf' },
] satisfies Array<DocumentoRequerido & { sufijo: string; extension: string; mime: string }>;

export function documentoAdicional(numero?: number) {
  return DOCUMENTOS_ADICIONALES.find(documento => documento.numero === numero);
}

export function archivoAdicionalValido(archivo: File, numero: number): boolean {
  const tipo = documentoAdicional(numero);
  return !!tipo && archivo.name.split('.').pop()?.toLowerCase() === tipo.extension
    && (!archivo.type || archivo.type.toLowerCase() === tipo.mime.toLowerCase())
    && archivo.size > 0 && archivo.size <= 10 * 1024 * 1024;
}
