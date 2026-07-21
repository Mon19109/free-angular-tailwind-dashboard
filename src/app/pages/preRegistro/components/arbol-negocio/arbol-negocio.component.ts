import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-arbol-negocio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './arbol-negocio.component.html',
  styleUrls: ['./arbol-negocio.component.css'],
})
export class ArbolNegocioComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() tituloTipoNegocio = '';
  @Input() nivelPadre = 'Sucursal';
  @Input() mostrarEntidades = false;
  @Input() mostrarSucursales = true;
  @Input() mostrarCajas = true;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  esInvalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control?.invalid && control.touched);
  }

  normalizar(campo: 'numeroEntidades' | 'numeroSucursales' | 'numeroCajas', minimo: number): void {
    const control = this.form.get(campo);
    const valor = this.obtenerValor(campo, minimo);
    control?.setValue(String(Math.max(minimo, valor)));
    if (this.ubicacionSeleccionada) {
      this.form.get('ubicacionSeleccionada')?.setValue('');
    }
    this.form.get('cajasPorSucursal')?.setValue('');
  }

  private get ubicacionSeleccionada(): string {
    return `${this.form.get('ubicacionSeleccionada')?.value ?? ''}`;
  }

  private obtenerValor(campo: 'numeroEntidades' | 'numeroSucursales' | 'numeroCajas', minimo: number): number {
    const valor = Number(this.form.get(campo)?.value);
    return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : minimo;
  }

}
