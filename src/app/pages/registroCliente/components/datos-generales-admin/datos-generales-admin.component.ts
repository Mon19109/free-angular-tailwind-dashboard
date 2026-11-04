import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Option, SelectComponent } from '../../../../shared/components/form/select/select.component';
import { ConsultaCatalogosLecturaService } from '../../services/consulta-catalogos-lectura.service';

interface ColoniaActual {
  idLocalidad?: string;
  colonia?: string;
}

/** Vista administrativa independiente; los catálogos se resuelven en el GET autorizado del BFF. */
@Component({
  selector: 'app-datos-generales-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectComponent],
  templateUrl: './datos-generales-admin.component.html',
  styleUrls: ['../../../preRegistro/preRegistro.component.css']
})
export class DatosGeneralesAdminComponent {
  private readonly catalogosLectura = inject(ConsultaCatalogosLecturaService);
  @Input() descripcionRegimenFiscal = '';

  @Input() incluirRepresentantePersonaMoral = false;
  @Input() form!: FormGroup;
  @Input() campos: string[] = [];
  @Input() regimenesFiscales: string[] = [];
  @Input() localidadesFiscal: ColoniaActual[] = [];
  @Input() localidadesComercial: ColoniaActual[] = [];
  @Input() localidadesRepresentante: ColoniaActual[] = [];
  // Sólo Consulta de Comercios: el DTO BFF contiene la descripción, sin ID de localidad.
  @Input() conservarColoniaRepresentante = false;
  @Input() cargandoLocalidadesFiscal = false;
  @Input() cargandoLocalidadesComercial = false;
  @Input() cargandoLocalidadesRepresentante = false;
  @Input() tipoComercio: string = '';
  @Input() mostrarInfoFiscalEntidad = false;
  @Input() infoFiscalEntidadActiva = false;
  @Input() mostrarMismoDomicilio = true;
  @Input() bloquearTipoPersona = false;
  @Input() forzarDatosCaja = false;
  @Input() validarSoloCambios = false;
  @Input() textoContinuar = 'Guardar y continuar';
  @Input() mostrarContinuar = true;
  @Output() continuar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() cambiarInfoFiscalEntidad = new EventEmitter<boolean>();
  @Output() seleccionarLocalidadFiscal = new EventEmitter<string>();
  @Output() seleccionarLocalidadComercial = new EventEmitter<string>();
  @Output() seleccionarLocalidadRepresentante = new EventEmitter<string>();

  readonly tipoVialidadOptions: Option[] = [
    { label: 'Ampliación', value: 'Ampliación' },
    { label: 'Andador', value: 'Andador' },
    { label: 'Avenida', value: 'Avenida' },
    { label: 'Boulevard', value: 'Boulevard' },
    { label: 'Calle', value: 'Calle' },
    { label: 'Callejón', value: 'Callejón' },
    { label: 'Calzada', value: 'Calzada' },
    { label: 'Carretera', value: 'Carretera' },
  ];

  get esPersonaFisica(): boolean {
    return this.form.get('tipoPersona')?.value === 'PF';
  }

  get esPersonaMoral(): boolean {
    return this.form.get('tipoPersona')?.value === 'PM';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  tiene(campo: string): boolean { return this.campos.includes(campo); }

  get regimenFiscalOptions(): Option[] {
    return this.catalogosLectura.conservarValorActual(
      this.regimenesFiscales.map(regimen => ({ label: regimen, value: regimen })),
      this.form.get('regimenFiscal')?.value,
      this.descripcionRegimenFiscal
    );
  }

  get localidadesFiscalOptions(): Option[] {
    return this.catalogosLectura.conservarValorActual(
      this.localidadesFiscal
        .map(localidad => ({ label: localidad.colonia ?? '', value: localidad.colonia ?? '' }))
        .filter(option => option.value),
      this.form.get('colonia')?.value
    );
  }

  get localidadesComercialOptions(): Option[] {
    return this.catalogosLectura.conservarValorActual(
      this.localidadesComercial
        .map(localidad => ({ label: localidad.colonia ?? '', value: localidad.colonia ?? '' }))
        .filter(option => option.value),
      this.form.get('coloniaComercial')?.value
    );
  }

  get localidadesRepresentanteOptions(): Option[] {
    return this.localidadesRepresentante
      .map(localidad => {
        const colonia = localidad.colonia ?? '';
        return {
          label: colonia,
          value: colonia
        };
      })
      .filter(option => option.value);
  }

  get usarSelectorColoniaRepresentante(): boolean {
    if ((this.form.get('codigoPostalRepresentante')?.value || '').length !== 5) return false;
    if (!this.conservarColoniaRepresentante) return true;
    const colonia = this.form.get('coloniaRepresentante')?.value || '';
    const opciones = this.localidadesRepresentanteOptions;
    // No modificar el control al cargar opciones: conservar también la captura manual.
    return opciones.length > 0 && (!colonia || opciones.some(opcion => opcion.value === colonia));
  }

  get placeholderColoniaFiscal(): string {
    if (this.localidadesFiscal.length > 0) return 'Selecciona una colonia';
    return this.cargandoLocalidadesFiscal ? 'Cargando colonias...' : 'Sin colonias para este CP';
  }

  get placeholderColoniaComercial(): string {
    if (this.localidadesComercial.length > 0) return 'Selecciona una colonia';
    return this.cargandoLocalidadesComercial ? 'Cargando colonias...' : 'Sin colonias para este CP';
  }

  get placeholderColoniaRepresentante(): string {
    if (this.localidadesRepresentante.length > 0) return 'Selecciona una colonia';
    return this.cargandoLocalidadesRepresentante ? 'Cargando colonias...' : 'Sin colonias para este CP';
  }

  seleccionarColoniaFiscal(colonia: string): void {
    const localidad = this.localidadesFiscal.find(item => item.colonia === colonia);
    this.seleccionarLocalidadFiscal.emit(localidad?.idLocalidad ? String(localidad.idLocalidad) : '');
  }

  seleccionarColoniaComercial(colonia: string): void {
    const localidad = this.localidadesComercial.find(item => item.colonia === colonia);
    this.seleccionarLocalidadComercial.emit(localidad?.idLocalidad ? String(localidad.idLocalidad) : '');
  }

  seleccionarColoniaRepresentante(colonia: string): void {
    const localidad = this.localidadesRepresentante.find(item => item.colonia === colonia);
    this.seleccionarLocalidadRepresentante.emit(localidad?.idLocalidad ? String(localidad.idLocalidad) : '');
  }

  esInvalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  mensajeCampo(campo: string): string {
    const control = this.form.get(campo);
    if (control?.hasError('codigoPostalServicio')) return control.getError('codigoPostalServicio');
    if (control?.hasError('required')) return 'Debes llenar este campo.';
    if (control?.hasError('emailDuplicado')) return 'Este correo ya existe. Verifica el campo o reporta al Administrador.';
    if (control?.hasError('email')) return 'Ingresa un correo válido.';
    if (control?.hasError('rfcInvalido')) return 'Ingresa un RFC válido.';
    if (control?.hasError('curpInvalida')) return 'Ingresa una CURP válida.';
    if (control?.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control?.hasError('minlength')) {
      if (campo === 'rfc') return 'Ingresa un RFC de 12 o 13 caracteres.';
      if (campo === 'curp') return 'Ingresa una CURP de 18 caracteres.';
      if (campo.toLowerCase().includes('telefono')) return 'Ingresa un teléfono de 10 dígitos.';
    }
    if (control?.hasError('pattern')) {
      if (campo.toLowerCase().includes('telefono')) return 'Ingresa un teléfono de 10 dígitos.';
      return 'El formato no es válido.';
    }
    return 'Debes llenar este campo.';
  }

  get seccionesVisibles() {
    const tipo = this.tipoComercio;
    const esCaja = [
      'Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI',
      'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'
    ].includes(tipo);
    const tiposConRepresentante = ['Empresa Holding', 'Empresa Grupo', 'Empresa Agrupadora', 'Entidad Agrupadora', 'Entidad Agrupadora con auditor', 'Entidad Agrupadora con supervisor', 'Sucursales de Grupo', 'Sucursales Únicas'];
    const esPersonaFisica = this.form.get('tipoPersona')?.value === 'PF';
    const esTipoPersonaFisicaSinRepresentante = (this.incluirRepresentantePersonaMoral || tiposConRepresentante.includes(tipo)) && esPersonaFisica;
    const ocultarDatosPorCaja = esCaja && !this.forzarDatosCaja;
    const mostrarDireccionRepresentante = !esCaja
      && (this.incluirRepresentantePersonaMoral || tiposConRepresentante.includes(tipo))
      && !esTipoPersonaFisicaSinRepresentante;
    const mostrarRepresentante = !esCaja && (this.incluirRepresentantePersonaMoral || tiposConRepresentante.includes(tipo)) && !esTipoPersonaFisicaSinRepresentante;

    return {
      datosGenerales:     !ocultarDatosPorCaja,
      domicilioFiscal:    !ocultarDatosPorCaja,
      representante:      mostrarRepresentante,
      dirRepresentante:   mostrarDireccionRepresentante,
      contactoRep:        false,
      domicilioComercial: true,
      contactoComercial:  !this.forzarDatosCaja,
    };
  }

 submit(): void {
  if (!this.mostrarContinuar) return;

  this.form.markAllAsTouched();

  if (this.form.invalid && !this.validarSoloCambios) {
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
