import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GiroComercial, PreRegistroService } from '../../../../services/preregistro.service';

interface GiroBusqueda {
  familia: string;
  descripcion: string;
  mcc: string;
}

@Component({
  selector: 'app-step-datos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-datos.component.html',
  styleUrls: ['../../preRegistro.component.css']
})
export class StepDatosComponent implements OnInit {
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() form!: FormGroup;
  @Input() campos: string[] = [];
  @Input() regimenesFiscales: string[] = [];
  @Input() girosComerciales: string[] = [];
  @Input() tiposPersona: string[] = [];
  @Input() departamentos: string[] = [];
  @Input() ciudades: string[] = [];
  @Input() tipoComercio: string = '';
  @Input() mostrarInfoFiscalEntidad = false;
  @Input() infoFiscalEntidadActiva = false;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() cambiarInfoFiscalEntidad = new EventEmitter<boolean>();

  // ── Búsqueda avanzada ──────────────────────────────────────────────────────
  readonly minimoCaracteresBusqueda = 2;
  mostrarModalGiro = false;
  terminoBusqueda = new FormControl('');

  // ← UNA SOLA declaración con el tipo correcto
  giroSeleccionado: GiroBusqueda | null = null;
  cargandoGiros = false;
  errorGiros = '';

  girosBusqueda: GiroBusqueda[] = [];

  ngOnInit(): void {
    this.terminoBusqueda.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(termino => this.buscarGirosComerciales(termino ?? ''));
  }

  // ── Métodos búsqueda avanzada ──────────────────────────────────────────────
  get girosFiltrados(): GiroBusqueda[] {
    const term = (this.terminoBusqueda.value ?? '').trim().toLowerCase();
    if (term.length < this.minimoCaracteresBusqueda) return [];
    return this.girosBusqueda.filter(g =>
      g.descripcion.toLowerCase().includes(term) ||
      g.familia.toLowerCase().includes(term) ||
      g.mcc.includes(term)
    );
  }

  buscarGirosComerciales(termino: string): void {
    const family = termino.trim();

    if (family.length < this.minimoCaracteresBusqueda) {
      this.cargandoGiros = false;
      this.errorGiros = '';
      this.giroSeleccionado = null;
      this.girosBusqueda = [];
      return;
    }

    this.cargandoGiros = true;
    this.errorGiros = '';

    this.preRegistroService.getGirosByFamily(family).subscribe({
      next: response => {
        const giros = this.normalizarGiros(response);
        this.girosBusqueda = giros;
        this.cargandoGiros = false;
      },
      error: error => {
        console.error('Error al cargar giros comerciales:', error);
        this.errorGiros = 'No se pudieron cargar los giros, intenta nuevamente.';
        this.cargandoGiros = false;
      }
    });
  }

  private normalizarGiros(response: unknown): GiroBusqueda[] {
    const lista = this.obtenerListaGiros(response);

    return lista.map(giro => ({
      familia: this.obtenerTexto(giro, ['familia', 'family', 'giro', 'name']),
      descripcion: this.obtenerTexto(giro, ['descripcion', 'description', 'desGiro', 'actividad', 'label']),
      mcc: this.obtenerTexto(giro, ['mcc', 'MCC', 'codigoMcc', 'idGiro', 'id'])
    })).filter(giro => giro.descripcion || giro.familia || giro.mcc);
  }

  private obtenerListaGiros(response: unknown): GiroComercial[] {
    if (Array.isArray(response)) return response as GiroComercial[];
    if (!response || typeof response !== 'object') return [];

    const payload = response as Record<string, unknown>;
    const posiblesListas = ['rows', 'data', 'giros', 'catGiroResponse', 'result', 'response'];

    for (const key of posiblesListas) {
      const value = payload[key];
      if (Array.isArray(value)) return value as GiroComercial[];
    }

    return [];
  }

  private obtenerTexto(giro: GiroComercial, keys: string[]): string {
    for (const key of keys) {
      const value = giro[key];
      if (value !== null && value !== undefined) return String(value);
    }

    return '';
  }

  abrirModalGiro(): void {
    this.terminoBusqueda.setValue('');
    this.giroSeleccionado = null;
    this.mostrarModalGiro = true;
  }

  cerrarModalGiro(): void {
    this.mostrarModalGiro = false;
  }

  seleccionarGiroModal(giro: GiroBusqueda): void {
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
      'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'
    ].includes(tipo);
    return {
      datosGenerales:     !esCaja,
      domicilioFiscal:    !esCaja && !this.infoFiscalEntidadActiva,
      representante:      !esCaja && !this.infoFiscalEntidadActiva && !sinRepresentante.includes(tipo),
      dirRepresentante:   !esCaja && !this.infoFiscalEntidadActiva && !sinRepresentante.includes(tipo),
      contactoRep:        !esCaja && !this.infoFiscalEntidadActiva && !sinRepresentante.includes(tipo),
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
