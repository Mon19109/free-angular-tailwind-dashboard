import { nombreEstatusOperacion } from './estatus-operaciones';
import { nombreBancoPorCodigo } from './bancos';

export const COLUMNAS_OPERACIONES = [
  { titulo: 'ID', campo: 'id' },
  { titulo: 'TIPO', campo: 'descriptionType' },
  { titulo: 'VENTA NETA', campo: 'amount', moneda: true },
  { titulo: 'MONTO', campo: 'processingCode' },
  { titulo: 'ESTATUS', campo: 'status' },
  { titulo: 'DESCRIPCIÓN', campo: 'description' },
  { titulo: 'FECHA', campo: 'createdAt' },
  { titulo: 'CODIGO DE RESPUESTA', campo: 'responseCode' },
  { titulo: 'REFERENCIA NUMERICA', campo: 'numericReference' },
  { titulo: 'REFERENCIA ALFANUMERICA', campo: 'alphanumericReference' },
  { titulo: 'TARGETEMAIL', campo: 'targetEmail' },
  { titulo: 'REFERENCIA INTERNA', campo: 'internalReference' },
  { titulo: 'REFERENCIA EXTERNA', campo: 'externalReference' },
  { titulo: 'TRANSACTIONBUNDLER', campo: 'transactionBundler' },
  { titulo: 'OBSERVACIÓN', campo: 'observation' },
  { titulo: 'USUARIO', campo: 'targetName' },
  { titulo: 'USUARIO ORIGEN', campo: 'originalUsername' },
  { titulo: 'EMAIL ORIGEN', campo: 'originalEmail' },
  { titulo: 'CUENTA DESTINATARIO', campo: 'targetID' },
  { titulo: 'NOMBRE DEL DESTINATARIO', campo: 'targetName' },
  { titulo: 'BANCO DESTINATARIO', campo: 'targetIDCode' },
  { titulo: 'CEP INT.', campo: 'cepInt' },
  { titulo: 'CEP EXT.', campo: 'cepExt' }
];

export function valorColumnaOperacion(operacion: Record<string, unknown>, columna: typeof COLUMNAS_OPERACIONES[number]): string {
  const valor = operacion[columna.campo];
  if (columna.campo === 'status') return nombreEstatusOperacion(valor);
  if (columna.campo === 'createdAt') return fechaOperacion(valor);
  if (columna.campo === 'targetIDCode') return nombreBancoPorCodigo(valor);
  if (valor === undefined || valor === null || valor === '') return 'ND';
  if (columna.moneda) {
    const numero = Number(valor);
    return Number.isFinite(numero)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numero)
      : 'ND';
  }
  return String(valor);
}

/** Conserva la fecha y hora del servicio sin convertir a la zona del navegador. */
export function fechaOperacion(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return 'ND';
  const texto = String(valor).trim();
  const partes = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(texto);
  return partes ? `${partes[1]} ${partes[2]}` : texto;
}
