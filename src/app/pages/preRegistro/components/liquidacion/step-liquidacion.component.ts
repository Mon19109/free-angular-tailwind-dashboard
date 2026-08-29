import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Actividad, ActividadesService } from '../../../../services/actividades.service';
import { GiroComercial, PreRegistroService } from '../../../../services/preregistro.service';
import { BeneficiariosService } from '../../../../services/beneficiarios.service';

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
  selector: 'app-step-liquidacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-liquidacion.component.html',
    styleUrls: ['../../preRegistro.component.css']
})
export class StepLiquidacionComponent implements OnInit {
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly beneficiariosService = inject(BeneficiariosService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() form!: FormGroup;
  @Input() tiposCuenta: string[] = [];
  @Input() beneficiarioIgualComercio = false;
  @Input() mostrarBeneficiarioIgualComercio = true;
  @Input() habilitarBusquedasCatalogo = false;
  @Input() mostrarDocumentosLiquidacion = true;
  @Input() textoContinuar = 'Guardar y continuar';
  @Input() permitirVacio = false;
  @Input() varianteRegistro = false;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();

  readonly opcionesRecepcionRegistro = [
    { valor: 'otros-bancos', etiqueta: 'Otros Bancos' },
    { valor: 'en-red', etiqueta: 'En Red' },
    { valor: 'otros-bancos-en-red', etiqueta: 'Otros Bancos y En Red' },
  ];
  readonly minimoCaracteresBusqueda = 2;
  terminoBusqueda = new FormControl('');
  terminoActividad = new FormControl('');
  mostrarModalGiro = false;
  mostrarModalActividad = false;
  giroSeleccionado: GiroBusqueda | null = null;
  actividadSeleccionada: ActividadBusqueda | null = null;
  girosBusqueda: GiroBusqueda[] = [];
  actividadesBusqueda: ActividadBusqueda[] = [];
  instituciones: any[] = [];
  cargandoGiros = false;
  cargandoActividades = false;
  buscandoInstitucion = false;
  errorGiros = '';
  errorActividades = '';
  errorInstituciones = '';

  ngOnInit(): void {
    this.terminoBusqueda.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(termino => this.buscarGirosComerciales(termino ?? ''));
  }

  get tipoPersonaBeneficiario(): 'fisica' | 'moral' {
    return this.form.get('tipoPersonaBeneficiario')?.value ?? 'fisica';
  }

  get requiereDatosLiquidacion(): boolean {
    const valor = this.form.get('cuentaFueraRed')?.value;
    return valor === 'otros-bancos' || valor === 'otros-bancos-en-red' || valor === 'si';
  }

  get tipoCuenta(): string {
    return this.form.get('tipoCuenta')?.value ?? '';
  }

  get etiquetaCuenta(): string {
    return this.tipoCuenta === 'Tarjeta' ? 'Número de tarjeta' : 'CLABE / número de cuenta';
  }

  get longitudCuenta(): number {
    return this.tipoCuenta === 'Tarjeta' ? 16 : 18;
  }

  get girosFiltrados(): GiroBusqueda[] {
    const term = (this.terminoBusqueda.value ?? '').trim();
    if (term.length < this.minimoCaracteresBusqueda) return [];
    return this.girosBusqueda;
  }

  get actividadesFiltradas(): ActividadBusqueda[] {
    const term = (this.terminoActividad.value ?? '').trim().toLowerCase();
    if (term.length < this.minimoCaracteresBusqueda) return [];
    return this.actividadesBusqueda.filter(actividad =>
      actividad.descripcion.toLowerCase().includes(term) ||
      actividad.id.toLowerCase().includes(term)
    );
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
    if (control?.hasError('minlength') || control?.hasError('maxlength')) {
      if (campo === 'rfcBeneficiario') return 'Ingresa un RFC de 12 o 13 caracteres.';
      if (campo === 'digitoVerificador') return 'Ingresa un dígito verificador de 5 dígitos.';
      if (campo.toLowerCase().includes('telefono')) return 'Ingresa un teléfono de 10 dígitos.';
    }
    if (control?.hasError('clabeInvalida')) return 'Ingresa una CLABE válida de 18 dígitos.';
    if (control?.hasError('tarjetaInvalida')) return 'Ingresa un número de tarjeta de 16 dígitos.';
    if (control?.hasError('pattern')) return 'El formato no es válido.';
    return 'Debes llenar este campo.';
  }

  submit(): void {
    if (this.permitirVacio) {
      this.continuar.emit();
      return;
    }

    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.continuar.emit();
  }

  abrirModalGiro(): void {
    if (!this.habilitarBusquedasCatalogo || this.tipoPersonaBeneficiario !== 'moral') return;
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
      giroBeneficiario: this.giroSeleccionado.descripcion || this.giroSeleccionado.familia,
    });
    this.mostrarModalGiro = false;
  }

  abrirModalActividad(): void {
    if (!this.habilitarBusquedasCatalogo || this.tipoPersonaBeneficiario !== 'fisica') return;
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
    this.form.patchValue({ actividadBeneficiario: this.actividadSeleccionada.descripcion });
    this.mostrarModalActividad = false;
  }

  buscarBanco(): void {
    this.errorInstituciones = '';
    this.instituciones = [];
    const cuenta = `${this.form.get('cuentaClabe')?.value ?? ''}`.trim();
    if (!cuenta) {
      this.errorInstituciones = 'Captura una cuenta o CLABE para buscar el banco.';
      return;
    }

    this.buscandoInstitucion = true;
    this.beneficiariosService.buscarInstitucion(cuenta).pipe(
      finalize(() => this.buscandoInstitucion = false)
    ).subscribe({
      next: resp => {
        const institutionResponse = resp?.institutionResponse || resp?.data?.institutionResponse || resp?.data || resp;
        this.instituciones = Array.isArray(institutionResponse?.institutions) ? institutionResponse.institutions : [];
        if (!this.instituciones.length) {
          this.errorInstituciones = 'No se encontraron instituciones para la cuenta capturada.';
          return;
        }
        if (this.instituciones.length === 1) this.seleccionarInstitucion(this.obtenerInstitucionId(this.instituciones[0]));
      },
      error: () => {
        this.errorInstituciones = 'No fue posible buscar el banco.';
      }
    });
  }

  seleccionarInstitucion(id: string): void {
    const institucion = this.instituciones.find(item => this.obtenerInstitucionId(item) === id);
    this.form.patchValue({ nombreBanco: this.obtenerInstitucionTexto(institucion) });
  }

  obtenerInstitucionId(institucion: any): string {
    return String(institucion?.key ?? institucion?.idInstitution ?? institucion?.id ?? institucion?.institutionId ?? institucion?.code ?? '');
  }

  obtenerInstitucionTexto(institucion: any): string {
    if (!institucion) return '';
    return institucion?.name || institucion?.nameInstitution || institucion?.institutionName || institucion?.description || this.obtenerInstitucionId(institucion);
  }

  private buscarGirosComerciales(termino: string): void {
    if (!this.habilitarBusquedasCatalogo || this.tipoPersonaBeneficiario !== 'moral') return;
    const family = termino.trim();
    if (family.length < this.minimoCaracteresBusqueda) {
      this.girosBusqueda = [];
      this.giroSeleccionado = null;
      this.errorGiros = '';
      return;
    }

    this.cargandoGiros = true;
    this.errorGiros = '';
    this.preRegistroService.getGirosByFamily(family).subscribe({
      next: response => {
        this.girosBusqueda = this.normalizarGiros(response);
        this.cargandoGiros = false;
      },
      error: () => {
        this.errorGiros = 'No se pudieron cargar los giros, intenta nuevamente.';
        this.cargandoGiros = false;
      }
    });
  }

  private cargarActividades(): void {
    this.cargandoActividades = true;
    this.errorActividades = '';
    this.actividadesService.getActividades().subscribe({
      next: response => {
        this.actividadesBusqueda = this.normalizarActividades(response);
        this.cargandoActividades = false;
      },
      error: () => {
        this.errorActividades = 'No se pudieron cargar las actividades, intenta nuevamente.';
        this.cargandoActividades = false;
      }
    });
  }

  private normalizarGiros(response: unknown): GiroBusqueda[] {
    const lista = this.obtenerListaGiros(response);
    return lista.map(giro => ({
      familia: this.obtenerTexto(giro, ['familia', 'family', 'giro', 'giroComercial', 'businessLine', 'name', 'nombre']),
      descripcion: this.obtenerTexto(giro, ['descripcion', 'description', 'desGiro', 'actividad', 'activity', 'label', 'nombreGiro']),
      mcc: this.obtenerTexto(giro, ['mcc', 'MCC', 'codigoMcc', 'codigoMCC', 'idGiro', 'id', 'code', 'codigo'])
    })).filter(giro => giro.descripcion || giro.familia || giro.mcc);
  }

  private obtenerListaGiros(response: unknown): GiroComercial[] {
    if (Array.isArray(response)) return response as GiroComercial[];
    if (!response || typeof response !== 'object') return [];
    const payload = response as Record<string, unknown>;
    const posiblesListas = ['rows', 'data', 'giros', 'catGiroResponse', 'result', 'response', 'items', 'list', 'content'];
    for (const key of posiblesListas) {
      const value = payload[key];
      if (Array.isArray(value)) return value as GiroComercial[];
      const listaAnidada = this.obtenerListaGiros(value);
      if (listaAnidada.length) return listaAnidada;
    }
    return [];
  }

  private normalizarActividades(actividades: Actividad[]): ActividadBusqueda[] {
    return actividades.map(actividad => ({
      id: this.obtenerTexto(actividad, ['idcat_actividades', 'idActivity', 'id', 'code']),
      descripcion: this.obtenerTexto(actividad, ['descripcion', 'description', 'actividad', 'activity', 'nombre', 'name', 'label']),
    })).filter(actividad => actividad.descripcion || actividad.id);
  }

  private obtenerTexto(objeto: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = objeto[key];
      if (value !== null && value !== undefined) return String(value);
    }
    return '';
  }

  private tieneDatosCapturados(): boolean {
    const valores = this.form.getRawValue();
    return Object.entries(valores).some(([campo, valor]) => {
      if (campo === 'cuentaFueraRed' || campo === 'tipoPersonaBeneficiario' || campo === 'beneficiarioIgualComercio') {
        return false;
      }

      if (typeof valor === 'string') return valor.trim() !== '';
      return valor !== null && valor !== undefined && valor !== false;
    });
  }
}
