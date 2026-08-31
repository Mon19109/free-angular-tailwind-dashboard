export interface DocumentoRequerido {
  numero: number;
  nombre: string;
  obligatorio: boolean;
  archivo?: File;
  archivoNombre?: string;
  archivoUrl?: string;
  archivoId?: string;
  s3Key?: string;
  tipoArchivo?: string;
  estado?: string;
  estatusRevision?: 'APPROVED' | 'REJECTED' | 'IN_REVIEW';
}
