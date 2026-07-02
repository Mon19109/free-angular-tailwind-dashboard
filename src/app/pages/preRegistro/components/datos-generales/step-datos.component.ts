import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';

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

  // ── Búsqueda avanzada ──────────────────────────────────────────────────────
  mostrarModalGiro = false;
  terminoBusqueda = new FormControl('');

  // ← UNA SOLA declaración con el tipo correcto
  giroSeleccionado: { familia: string; descripcion: string; mcc: string } | null = null;

  readonly girosAN53: { familia: string; descripcion: string; mcc: string }[] = [
    { familia: 'Turismo',            descripcion: 'Agencias de Viajes',       mcc: '4722' },
    { familia: 'Servicios',          descripcion: 'Agencias de Publicidad',    mcc: '7311' },
    { familia: 'Seguros',            descripcion: 'Agencias de Seguros',       mcc: '6411' },
    { familia: 'Agropecuario',       descripcion: 'Agricultura y Ganadería',   mcc: '0100' },
    { familia: 'Alimentos',          descripcion: 'Alimentos y Bebidas',       mcc: '5499' },
    { familia: 'Construcción',       descripcion: 'Arquitectura e Ingeniería', mcc: '8711' },
    { familia: 'Automotriz',         descripcion: 'Automotriz',                mcc: '5511' },
    { familia: 'Comercio',           descripcion: 'Comercio al por Mayor',     mcc: '5099' },
    { familia: 'Comercio',           descripcion: 'Comercio al por Menor',     mcc: '5999' },
    { familia: 'Telecomunicaciones', descripcion: 'Comunicaciones',            mcc: '4899' },
    { familia: 'Construcción',       descripcion: 'Construcción',              mcc: '1520' },
    { familia: 'Servicios',          descripcion: 'Consultoría Empresarial',   mcc: '7389' },
    { familia: 'Educación',          descripcion: 'Educación',                 mcc: '8299' },
    { familia: 'Entretenimiento',    descripcion: 'Entretenimiento',           mcc: '7999' },
    { familia: 'Salud',              descripcion: 'Farmacéutico',              mcc: '5912' },
    { familia: 'Turismo',            descripcion: 'Hotelería y Turismo',       mcc: '7011' },
    { familia: 'Industria',          descripcion: 'Industria Manufacturera',   mcc: '5040' },
    { familia: 'Tecnología',         descripcion: 'Informática y Tecnología',  mcc: '7372' },
    { familia: 'Transporte',         descripcion: 'Logística y Transporte',    mcc: '4731' },
    { familia: 'Salud',              descripcion: 'Médico y Salud',            mcc: '8099' },
    { familia: 'Alimentos',          descripcion: 'Restaurantes',              mcc: '5812' },
    { familia: 'Finanzas',           descripcion: 'Servicios Financieros',     mcc: '6199' },
    { familia: 'Servicios',          descripcion: 'Servicios Profesionales',   mcc: '8999' },
    { familia: 'Comercio',           descripcion: 'Tiendas de Ropa',           mcc: '5651' },
  ];

  // ── Métodos búsqueda avanzada ──────────────────────────────────────────────
  get girosFiltrados(): { familia: string; descripcion: string; mcc: string }[] {
    const term = (this.terminoBusqueda.value ?? '').trim().toLowerCase();
    if (!term) return [];
    return this.girosAN53.filter(g =>
      g.descripcion.toLowerCase().includes(term) ||
      g.familia.toLowerCase().includes(term) ||
      g.mcc.includes(term)
    );
  }

  abrirModalGiro(): void {
    this.terminoBusqueda.setValue('');
    this.giroSeleccionado = null;
    this.mostrarModalGiro = true;
  }

  cerrarModalGiro(): void {
    this.mostrarModalGiro = false;
  }

  seleccionarGiroModal(giro: { familia: string; descripcion: string; mcc: string }): void {
    this.giroSeleccionado = giro;
  }

  guardarGiroModal(): void {
    if (!this.giroSeleccionado) return;
    this.form.patchValue({
      giroComercial:   this.giroSeleccionado.familia,
      descripcionGiro: this.giroSeleccionado.descripcion,
      mcc:             this.giroSeleccionado.mcc,
    });
    this.mostrarModalGiro = false;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  tiene(campo: string): boolean { return this.campos.includes(campo); }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  get seccionesVisibles() {
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
      datosGenerales:     !esCaja,
      domicilioFiscal:    !esCaja,
      representante:      !esCaja && !sinRepresentante.includes(tipo),
      dirRepresentante:   !esCaja && !sinRepresentante.includes(tipo),
      contactoRep:        !esCaja && !sinRepresentante.includes(tipo),
      domicilioComercial: true,
      contactoComercial:  true,
    };
  }

 submit(): void {

  this.form.markAllAsTouched();

  if (this.form.invalid) {

    console.log('====== FORMULARIO INVÁLIDO ======');

    Object.keys(this.form.controls).forEach(nombre => {

      const control = this.form.get(nombre);

      if (control?.invalid) {
        console.log(
          nombre,
          control.errors,
          control.value
        );
      }

    });

    this.irAlPrimerError();
    return;
  }

  console.log('Formulario válido');

  this.continuar.emit();
}

private irAlPrimerError(): void {
  setTimeout(() => {
    const primerCampoInvalido = document.querySelector('.invalid, input.ng-invalid, select.ng-invalid');
    if (primerCampoInvalido) {
      primerCampoInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 0);
}
}