/** Contratos del portal privado. Las referencias no son IDs de las APIs originales. */
export type Referencia = string;
export type EstadoDocumento = 'APPROVED' | 'REJECTED' | 'IN_REVIEW';
export type Dispersion = 'NETWORK' | 'OTHER_BANK' | 'OTHER_BANK_AND_NETWORK';
export interface ResultadoOperacion { success: true; }
export interface FiltrosComercios {
  nombre?: string; correo?: string; telefono?: string; rfc?: string; estado?: string;
}
export interface ComercioResumen {
  ref: Referencia; nombre: string; razonSocial: string; rfc: string;
  correo: string; telefono: string; nivel: string; estado: string; acciones: string[];
}
export interface NodoComercio {
  ref: Referencia; nombre: string; nivel: string; hijos: NodoComercio[];
}
export interface DireccionComercio {
  tipo: 'DF' | 'DC'; codigoPostal: string; tipoVialidad: string; vialidad: string;
  exterior: string; interior: string; colonia: string; localidad: string;
  municipio: string; estado: string; entreCalle: string; yCalle: string;
  localidadRef?: Referencia;
}
export interface ContactoComercio {
  tipo: 1 | 2; nombre: string; apellidoPaterno: string; apellidoMaterno: string;
  correo: string; telefono: string; telefonoAdicional: string;
  direccion?: DireccionContacto;
}
export interface DireccionContacto {
  calle: string; exterior: string; interior: string; codigoPostal: string;
  colonia: string; municipio: string; estado: string; localidadRef?: Referencia;
}
export interface DatosComercio {
  nombre: string; apellidoPaterno: string; apellidoMaterno: string;
  nombreComercial: string; razonSocial: string; rfc: string; curp: string;
  correo: string; telefono: string; tipoPersona: string; regimenFiscal: string;
  actividad: string; giro: string; mcc: string;
  actividadRef?: Referencia; giroRef?: Referencia;
  direcciones: DireccionComercio[]; contactos: ContactoComercio[];
}
export interface ComercioDetalle {
  ref: Referencia; datos: DatosComercio; estado: string; nivel: string;
  dispersion: Dispersion | ''; tieneAccesos: boolean; acciones: string[];
}
/** Campos omitidos se conservan en servidor. Nunca enviar una cuenta original completa. */
export type CambiosComercio = Partial<DatosComercio>;
export interface DocumentoComercio {
  ref: Referencia; nombre: string; tipo: string; estado: EstadoDocumento;
}
export interface RevisionDocumental {
  documentos: DocumentoComercio[]; observacionesInternas: string;
}
export interface GuardarRevision {
  documentos: Array<{ ref: Referencia; estado: EstadoDocumento }>;
  observacionesInternas: string;
}
export interface ResultadoPld {
  rfc: string; nombre: string; fecha: string; coincidencia: string;
  categoria: string; fuente: string;
}
export interface OpcionCatalogo {
  ref: Referencia; descripcion: string; codigo?: string;
  colonia?: string; municipio?: string; estado?: string;
}
export interface LiquidacionComercio {
  institucionRef: Referencia; cuenta: string; nombreBeneficiario: string;
  correo: string; tipoBeneficiario: 'PF' | 'PM'; direccionBanco: string;
  direccionBeneficiario: string; telefonoBanco: string; correoBanco: string;
  actividadRef?: Referencia; giroRef?: Referencia;
}
