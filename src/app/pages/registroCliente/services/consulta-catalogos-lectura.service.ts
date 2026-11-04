import { Injectable } from '@angular/core';
import type { Option } from '../../../shared/components/form/select/select.component';

/** Proyección de lectura: no consulta servicios ni modifica los valores del formulario. */
@Injectable({ providedIn: 'root' })
export class ConsultaCatalogosLecturaService {
  conservarValorActual(opciones: Option[], valor: unknown, descripcion?: unknown): Option[] {
    const actual = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';
    if (!actual.trim()) return opciones;
    const etiqueta = typeof descripcion === 'string' && descripcion.trim() ? descripcion : actual;
    const existe = opciones.some(opcion => opcion.value === actual);
    if (!existe) return [{ label: etiqueta, value: actual }, ...opciones];
    if (etiqueta === actual) return opciones;
    return opciones.map(opcion => opcion.value === actual ? { ...opcion, label: etiqueta } : opcion);
  }
}
