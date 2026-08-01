import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GiroComercial, PreRegistroService } from '../../../../services/preregistro.service';
import { CodigoPostalLocalizacion } from '../../../../services/localidades.service';
import { Actividad, ActividadesService } from '../../../../services/actividades.service';
import { Option, SelectComponent } from '../../../../shared/components/form/select/select.component';

interface GiroBusqueda {
  familia: string;
  descripcion: string;
  mcc: string;
}

interface ActividadBusqueda {
  id: string;
  descripcion: string;
}

@Component({
  selector: 'app-step-datos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectComponent],
  templateUrl: './step-datos.component.html',
  styleUrls: ['../../preRegistro.component.css']
})
export class StepDatosComponent implements OnInit {
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() form!: FormGroup;
  @Input() campos: string[] = [];
  @Input() regimenesFiscales: string[] = [];
  @Input() girosComerciales: string[] = [];
  @Input() tiposPersona: string[] = [];
  @Input() departamentos: string[] = [];
  @Input() ciudades: string[] = [];
  @Input() localidadesFiscal: CodigoPostalLocalizacion[] = [];
  @Input() localidadesComercial: CodigoPostalLocalizacion[] = [];
  @Input() cargandoLocalidadesFiscal = false;
  @Input() cargandoLocalidadesComercial = false;
  @Input() tipoComercio: string = '';
  @Input() mostrarInfoFiscalEntidad = false;
  @Input() infoFiscalEntidadActiva = false;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() cambiarInfoFiscalEntidad = new EventEmitter<boolean>();
  @Output() seleccionarLocalidadFiscal = new EventEmitter<string>();
  @Output() seleccionarLocalidadComercial = new EventEmitter<string>();

  // ── Búsqueda avanzada ──────────────────────────────────────────────────────
  readonly minimoCaracteresBusqueda = 2;
  mostrarModalGiro = false;
  mostrarModalActividad = false;
  terminoBusqueda = new FormControl('');
  terminoActividad = new FormControl('');

  // ← UNA SOLA declaración con el tipo correcto
  giroSeleccionado: GiroBusqueda | null = null;
  cargandoGiros = false;
  errorGiros = '';

  girosBusqueda: GiroBusqueda[] = [];
  actividadesBusqueda: ActividadBusqueda[] = [];
  actividadSeleccionada: ActividadBusqueda | null = null;
  cargandoActividades = false;
  errorActividades = '';

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

  get esPersonaFisica(): boolean {
    return this.form.get('tipoPersona')?.value === 'PF';
  }

  get esPersonaMoral(): boolean {
    return this.form.get('tipoPersona')?.value === 'PM';
  }

  get actividadesFiltradas(): ActividadBusqueda[] {
    const term = (this.terminoActividad.value ?? '').trim().toLowerCase();
    if (term.length < this.minimoCaracteresBusqueda) return [];
    return this.actividadesBusqueda.filter(actividad =>
      actividad.descripcion.toLowerCase().includes(term) ||
      actividad.id.toLowerCase().includes(term)
    );
  }

  buscarGirosComerciales(termino: string): void {
    if (!this.esPersonaMoral) {
      this.cargandoGiros = false;
      this.errorGiros = '';
      this.giroSeleccionado = null;
      this.girosBusqueda = [];
      return;
    }

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
        void error;
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
    if (!this.esPersonaMoral) return;
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

  abrirModalActividad(): void {
    if (!this.esPersonaFisica) return;
    this.terminoActividad.setValue('');
    this.actividadSeleccionada = null;
    this.mostrarModalActividad = true;
    if (this.actividadesBusqueda.length === 0) this.cargarActividades();
  }

  cerrarModalActividad(): void {
    this.mostrarModalActividad = false;
  }

  seleccionarActividadModal(actividad: ActividadBusqueda): void {
    this.actividadSeleccionada = actividad;
  }

  guardarActividadModal(): void {
    if (!this.actividadSeleccionada) return;
    this.form.patchValue({
      actividad: this.actividadSeleccionada.descripcion,
      actividadId: this.actividadSeleccionada.id,
    });
    this.mostrarModalActividad = false;
  }

  private cargarActividades(): void {
    this.cargandoActividades = true;
    this.errorActividades = '';

    this.actividadesService.getActividades().subscribe({
      next: response => {
        this.actividadesBusqueda = this.normalizarActividades(response);
        this.cargandoActividades = false;
      },
      error: error => {
        void error;
        this.errorActividades = 'No se pudieron cargar las actividades, intenta nuevamente.';
        this.cargandoActividades = false;
      }
    });
  }

  private normalizarActividades(actividades: Actividad[]): ActividadBusqueda[] {
    return actividades.map(actividad => ({
      id: this.obtenerTexto(actividad, ['idcat_actividades', 'idActivity', 'id', 'code']),
      descripcion: this.obtenerTexto(actividad, ['descripcion', 'description', 'actividad', 'activity', 'nombre', 'name', 'label']),
    })).filter(actividad => actividad.descripcion || actividad.id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  tiene(campo: string): boolean { return this.campos.includes(campo); }

  get regimenFiscalOptions(): Option[] {
    return this.regimenesFiscales.map(regimen => ({
      label: regimen,
      value: regimen
    }));
  }

  get localidadesFiscalOptions(): Option[] {
    return this.localidadesFiscal
      .map(localidad => {
        const colonia = localidad.colonia ?? '';
        return {
          label: colonia,
          value: colonia
        };
      })
      .filter(option => option.value);
  }

  get localidadesComercialOptions(): Option[] {
    return this.localidadesComercial
      .map(localidad => {
        const colonia = localidad.colonia ?? '';
        return {
          label: colonia,
          value: colonia
        };
      })
      .filter(option => option.value);
  }

  get placeholderColoniaFiscal(): string {
    if (this.localidadesFiscal.length > 0) return 'Selecciona una colonia';
    return this.cargandoLocalidadesFiscal ? 'Cargando colonias...' : 'Sin colonias para este CP';
  }

  get placeholderColoniaComercial(): string {
    if (this.localidadesComercial.length > 0) return 'Selecciona una colonia';
    return this.cargandoLocalidadesComercial ? 'Cargando colonias...' : 'Sin colonias para este CP';
  }

  seleccionarColoniaFiscal(colonia: string): void {
    const localidad = this.localidadesFiscal.find(item => item.colonia === colonia);
    this.seleccionarLocalidadFiscal.emit(localidad?.idLocalidad ? String(localidad.idLocalidad) : '');
  }

  seleccionarColoniaComercial(colonia: string): void {
    const localidad = this.localidadesComercial.find(item => item.colonia === colonia);
    this.seleccionarLocalidadComercial.emit(localidad?.idLocalidad ? String(localidad.idLocalidad) : '');
  }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  mensajeCampo(campo: string): string {
    const control = this.form.get(campo);
    if (control?.hasError('required')) return 'Debes llenar este campo.';
    if (control?.hasError('email')) return 'Ingresa un correo válido.';
    if (control?.hasError('rfcInvalido')) return 'Ingresa un RFC válido.';
    if (control?.hasError('curpInvalida')) return 'Ingresa una CURP válida.';
    if (control?.hasError('minlength') || control?.hasError('maxlength')) {
      if (campo === 'rfc') return 'Ingresa un RFC de 12 o 13 caracteres.';
      if (campo === 'curp') return 'Ingresa una CURP de 18 caracteres.';
      if (campo.toLowerCase().includes('telefono')) return 'Ingresa un teléfono de 10 dígitos.';
      if (campo.toLowerCase().includes('codigopostal')) return 'Ingresa un código postal de 5 dígitos.';
    }
    if (control?.hasError('pattern')) {
      if (campo.toLowerCase().includes('telefono')) return 'Ingresa un teléfono de 10 dígitos.';
      if (campo.toLowerCase().includes('codigopostal')) return 'Ingresa un código postal de 5 dígitos.';
      return 'El formato no es válido.';
    }
    return 'Debes llenar este campo.';
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
    this.irAlPrimerError();
    return;
  }

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
