import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-step-datos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-datos.component.html',
    styleUrls: ['../../preRegistro.component.css']
})
export class StepDatosComponent {
  @Input() form!: FormGroup;
  @Input() campos: string[] = [];
  @Input() regimenesFiscales: string[] = [];
  @Input() girosComerciales: string[] = [];
  @Input() tiposPersona: string[] = [];
  @Input() departamentos: string[] = [];
  @Input() ciudades: string[] = [];
  @Input() tipoComercio: string = '';
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();


  tiene(campo: string): boolean { return this.campos.includes(campo); }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

get seccionesVisibles() {
   console.log('tipoComercio:', this.tipoComercio, 'campos:', this.campos);
  const tipo = this.tipoComercio;
 
  const sinRepresentante = [
    'Persona Física', 'Sucursal Persona Física', 'Sucursales Únicas',
    'Referenciador', 'Comisionista'
  ];

  const esCaja = [
    'Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI',
    'Caja Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'
  ].includes(tipo);

  return {
    datosGenerales:    !esCaja,
    domicilioFiscal:   !esCaja,
    representante:     !esCaja && !sinRepresentante.includes(tipo),
    dirRepresentante:  !esCaja && !sinRepresentante.includes(tipo),
    contactoRep:       !esCaja && !sinRepresentante.includes(tipo),
    domicilioComercial: true,
    contactoComercial:  true,
  };
}




  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }

}