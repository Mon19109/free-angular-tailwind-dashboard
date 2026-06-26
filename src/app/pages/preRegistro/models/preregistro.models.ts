export interface DocumentoRequerido {
  numero: number;
  nombre: string;
  obligatorio: boolean;
  archivo?: File;
  archivoNombre?: string;
}