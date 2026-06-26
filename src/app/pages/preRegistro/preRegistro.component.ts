import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggleButtonComponent } from '../../shared/components/common/theme-toggle/theme-toggle-button.component';
import { DocumentoRequerido } from './models/preregistro.models';


// ── Steps ────────────────────────────────────────────────────────────────────
import { StepAfiliacionComponent } from './components/afiliacion/step-afiliacion.component';
import { StepComercioComponent } from './components/comercio/step-comercio.component';
import { StepDatosComponent } from './components/datos-generales/step-datos.component';
import { StepAccesosComponent } from './components/accesos/step-accesos.component';
import { StepLiquidacionComponent } from './components/liquidacion/step-liquidacion.component';
import { StepDocumentosComponent } from './components/documentos/step-documentos.component';

// ── Tipos locales ─────────────────────────────────────────────────────────────
type PasoWizard = 0 | 1 | 2 | 3 | 4 | 5;
type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type TipoComisionista = 'existente' | 'nuevo';

interface BorradorPreRegistro {
  pasoActual: PasoWizard;
  pasosCompletados: number[];
  registroTerminado: boolean;
  afiliacion: { afiliacion: string };
  comercio: { nivel: string; tipoComercio: string; afiliacionComisionista: string };
  comisionista: Record<string, string>;
  datos: Record<string, string | boolean>;
  accesos: Record<string, string | boolean>;
  liquidacion: Record<string, string | boolean>;
  documentos: Array<{ numero: number; archivoNombre?: string }>;
}

@Component({
  selector: 'app-preregistro',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ThemeToggleButtonComponent,
    StepAfiliacionComponent,
    StepComercioComponent,
    StepDatosComponent,
    StepAccesosComponent,
    StepLiquidacionComponent,
    StepDocumentosComponent,
  ],
  templateUrl: './preRegistro.component.html',
  styleUrls: ['./preRegistro.component.css'],
})
export class PreRegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftKey = 'kashpay.preregistro.draft.v1';

  // ── Estado UI ────────────────────────────────────────────────────────────────
  pasoActual: PasoWizard = 0;
  pasosCompletados = new Set<number>();
  mostrarAyuda = false;
  mostrarComisionista = false;
  mostrarBusquedaGiro = false;
  registroTerminado = false;
  archivosInvalidos = false;
  borradorGuardado = false;
  tipoPersonaBeneficiario: TipoPersonaBeneficiario = 'fisica';
  datosBeneficiarioIgualComercio = false;
  modoReservaActual: ModoReserva = 'NINGUNO';
  tiposComercio: string[] = [];


  // ── Datos estáticos (los consume el HTML y los steps vía [input]) ────────────
  readonly pasos = [
    { numero: 1, titulo: 'Descripción del Comercio' },
    { numero: 2, titulo: 'Datos Generales' },
    { numero: 3, titulo: 'Accesos a la Plataforma y Terminales TPV' },
    { numero: 4, titulo: 'Cuenta para Liquidación' },
    { numero: 5, titulo: 'Documentos del Comercio' },
  ];

  readonly requisitos = [
    'Acta constitutiva para persona moral.',
    'Poder vigente del representante legal.',
    'Constancia de situación fiscal reciente y completa.',
    'Identificación oficial vigente del representante legal. (INE y/o PASAPORTE VIGENTE)',
    'Datos de contacto del mismo representante legal. (Teléfono oficina, celular y correo electrónico)',
    'Relación y contactos de las personas responsables en el proyecto.',
    'Comprobante de domicilio no mayor a 3 meses.',
    'Correo electrónico y teléfono móvil activos.',
  ];


  // ── Objeto datos (agrupa estáticos para el HTML) ──────────────────────────────
  get datos() {
    return {
      pasos: this.pasos,
      requisitos: this.requisitos,
      niveles: this.niveles,
      modosReserva: this.modosReserva,
      tiposCuenta: this.tiposCuenta,
      tiposPersona: this.tiposPersona,
      departamentos: this.departamentos,
      ciudades: this.ciudades,
      regimenesFiscales: this.regimenesFiscales,
      girosComerciales: this.girosComerciales,
    };
  }


  readonly niveles = ['Sub Afiliado', 'Entidad', 'Sucursal', 'Caja', 'Referenciador', 'Comisionista'];
  readonly modosReserva: ModoReserva[] = ['NINGUNO', 'MANUAL', 'TRANSACCIONAL', 'AUTOMÁTICO', 'COMPLETO'];
  readonly tiposCuenta = ['CLABE', 'SPEI', 'Tarjeta'];
  readonly tiposPersona = ['Jurídica', 'Natural'];
  readonly departamentos = ['Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Atlántico'];
  readonly ciudades = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla'];
  readonly regimenesFiscales: string[] = [];
  readonly girosComerciales: string[] = [];

  readonly girosSugeridos = [
    { familia: 'Turismo', descripcion: 'Agencias de viajes', mcc: '4722' },
    { familia: 'Alimentos', descripcion: 'Restaurantes', mcc: '5812' },
    { familia: 'Comercio', descripcion: 'Tiendas de ropa', mcc: '5651' },
    { familia: 'Servicios', descripcion: 'Servicios profesionales', mcc: '8999' },
  ];

  readonly tiposComercioPorNivel: Record<string, string[]> = {
    'Sub Afiliado': ['Empresa Holding'],
    'Entidad': ['Empresa Grupo', 'Persona Física'],
    'Sucursal': ['Sucursales de Grupo', 'Sucursal Persona Física', 'Sucursales Únicas'],
    'Caja': ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Caja Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'],
    'Referenciador': [], 'Promotor': [], 'Comisionista': [],
  };

  readonly datosGeneralesPorTipo: Record<string, string[]> = {
    'Empresa Grupo': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Persona Física': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Empresa Holding': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales de Grupo': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursal Persona Física': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales Únicas': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Caja con Tarjeta sólo Fondeo': [], 'Caja con Tarjeta SPEI': [],
    'Caja Entidad': [], 'Cuenta Terminal': [], 'Cuenta Terminal Pin Rapido': [],
    'Referenciador': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Comisionista': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],

  };

  readonly documentos: DocumentoRequerido[] = [
    { numero: 1, nombre: 'Comprobante de domicilio', obligatorio: true },
    { numero: 2, nombre: 'Acta Constitutiva', obligatorio: true },
    { numero: 3, nombre: 'Identificación Oficial del Propietario', obligatorio: true },
    { numero: 4, nombre: 'Contrato', obligatorio: false },
    { numero: 5, nombre: 'Imagen Frente', obligatorio: true },
    { numero: 6, nombre: 'Imagen Interior', obligatorio: true },
    { numero: 7, nombre: 'Imagen Interior 2 del comercio', obligatorio: false },
    { numero: 8, nombre: 'Escrituras Públicas', obligatorio: false },
    { numero: 9, nombre: 'Poder del Representante', obligatorio: false },
    { numero: 10, nombre: 'Constancia Situación Fiscal', obligatorio: true },
    { numero: 11, nombre: 'E-Firma', obligatorio: false },
    { numero: 12, nombre: 'Identificación Oficial del Representante Legal', obligatorio: true },
    { numero: 13, nombre: 'Identificación Oficial de un tercero', obligatorio: false },
    { numero: 14, nombre: 'Carátula de Estado Cuenta para Liquidación', obligatorio: true },
  ];

  // ── Formularios ──────────────────────────────────────────────────────────────
  readonly afiliacionForm = this.fb.nonNullable.group({
    afiliacion: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
  });

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: [''],
  });

  readonly datosForm = this.fb.nonNullable.group({
    razonSocial: [''], nombreComercial: [''], rfc: [''],
    regimenFiscal: [''], giroComercial: [''], descripcionGiro: [''], mcc: [''],
    nombre: [''], apellidoPaterno: [''], apellidoMaterno: [''], curp: [''], actividad: [''],
    tipoPersona: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9\s()+-]{7,20}$/)]],
    departamento: ['', Validators.required],
    ciudad: ['', Validators.required],
    direccionComercial: ['', Validators.required],
    codigoPostal: [''], tipoVialidad: [''], nombreVialidad: [''],
    numeroExterior: [''], numeroInterior: [''], colonia: [''],
    localidad: [''], municipio: [''], entidadFederativa: [''],
    entreCalle: [''], yCalle: [''],
    nombreRepresentante: [''], apellidoPaternoRepresentante: [''], apellidoMaternoRepresentante: [''],
    calleRepresentante: [''], numeroExteriorRepresentante: [''], numeroInteriorRepresentante: [''],
    codigoPostalRepresentante: [''], coloniaRepresentante: [''],
    municipioRepresentante: [''], estadoRepresentante: [''],
    correoRepresentante: [''], telefonoRepresentante: [''], telefonoAdicionalRepresentante: [''],

    mismoDomicilio: [false],

    codigoPostalComercial: [''],
    tipoVialidadComercial: [''],
    nombreVialidadComercial: [''],
    numeroExteriorComercial: [''],
    numeroInteriorComercial: [''],
    coloniaComercial: [''],
    localidadComercial: [''],
    municipioComercial: [''],
    entidadFederativaComercial: [''],
    entreCalleComercial: [''],
    yCalleComercial: [''],

    correoComercial: [''],
    telefonoComercial: [''],
    telefonoAdicionalComercial: [''],


  });

  readonly accesosForm = this.fb.nonNullable.group({
    modoReserva: ['NINGUNO' as ModoReserva, Validators.required],
    reservaSplit: [''],
    adminNombre: ['', Validators.required], adminPaterno: ['', Validators.required], adminMaterno: ['', Validators.required],
    adminCorreo: ['', [Validators.required, Validators.email]],
    adminConfirmarCorreo: ['', [Validators.required, Validators.email]],
    adminTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    perfilReservaNombre: [''], perfilReservaPaterno: [''], perfilReservaMaterno: [''],
    perfilReservaCorreo: [''], perfilReservaConfirmarCorreo: [''], perfilReservaTelefono: [''],
    cajasTPV: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    tieneSupervisor: ['si', Validators.required],
    pinAdministrador: [''], pinCorreo: [''], pinConfirmarCorreo: [''], pinContrasena: [''],
  }, {
    validators: [
      this.camposCoincidenValidator('adminCorreo', 'adminConfirmarCorreo', 'adminCorreosDistintos'),
      this.camposCoincidenValidator('perfilReservaCorreo', 'perfilReservaConfirmarCorreo', 'perfilCorreosDistintos'),
      this.camposCoincidenValidator('pinCorreo', 'pinConfirmarCorreo', 'pinCorreosDistintos'),
      this.rangoSplitReservaValidator(),
    ],
  });

  readonly liquidacionForm = this.fb.nonNullable.group({
    tipoPersonaBeneficiario: ['fisica' as TipoPersonaBeneficiario, Validators.required],
    beneficiarioIgualComercio: [false],
    nombreBeneficiario: ['', Validators.required], apellidoPaternoBeneficiario: ['', Validators.required],
    apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]],
    direccionBeneficiario: ['', Validators.required], rfcBeneficiario: ['', Validators.required],
    actividadBeneficiario: ['', Validators.required], giroBeneficiario: ['', Validators.required],
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', [Validators.required, Validators.pattern(/^\d{18}$/)]],
    nombreBanco: ['', Validators.required], direccionBanco: ['', Validators.required],
    telefonoBanco: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    emailBanco: ['', [Validators.required, Validators.email]],
  });

  readonly busquedaGiroForm = this.fb.nonNullable.group({ termino: [''], resultado: [''] });

  readonly comisionistaForm = this.fb.nonNullable.group({
    tipo: ['existente' as TipoComisionista, Validators.required],
    afiliacion: [''], correo: [''], confirmarCorreo: [''],
    telefono: [''], nombre: [''], paterno: [''], materno: [''], rfc: [''],
  }, {
    validators: [this.camposCoincidenValidator('correo', 'confirmarCorreo', 'comisionistaCorreosDistintos')],
  });

  // ── Constructor ──────────────────────────────────────────────────────────────
  constructor() {
    this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value);
    this.actualizarEstadoLiquidacion(this.liquidacionForm.controls.beneficiarioIgualComercio.value);

    this.accesosForm.controls.modoReserva.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(modo => this.actualizarValidadoresAccesos(modo as ModoReserva));

    this.accesosForm.controls.tieneSupervisor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value as ModoReserva));

    this.liquidacionForm.controls.beneficiarioIgualComercio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(checked => this.actualizarEstadoLiquidacion(checked));

    this.liquidacionForm.controls.tipoPersonaBeneficiario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tipo => { this.tipoPersonaBeneficiario = tipo as TipoPersonaBeneficiario; });

    const sincronizar = () => { if (this.datosBeneficiarioIgualComercio) this.sincronizarBeneficiarioDesdeComercio(); };
    this.comercioForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sincronizar);
    this.datosForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sincronizar);

    this.datosForm.get('mismoDomicilio')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(valor => {

        if (valor) {
          this.copiarDomicilioFiscal();
        }

      });

    this.comercioForm.controls.nivel.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(nivel => {
        this.tiposComercio = this.tiposComercioPorNivel[nivel] ?? [];
        const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);

        if (esSinTipo) {
          this.comercioForm.controls.tipoComercio.clearValidators();
          this.comercioForm.controls.tipoComercio.setValue('');
        } else {
          this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
        }
        this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
      });

    this.comercioForm.controls.tipoComercio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tipo => { });

    this.cargarBorrador();
    this.tiposComercio = this.tiposComercioPorNivel[this.comercioForm.controls.nivel.value] ?? [];
  }

  // ── Getters ──────────────────────────────────────────────────────────────────
  get progresoWizard(): number {
    return this.pasoActual === 0 ? 0 : ((this.pasoActual - 1) / (this.pasos.length - 1)) * 100;
  }

  get documentosVisibles(): DocumentoRequerido[] {
    return this.modoReservaActual === 'COMPLETO'
      ? this.documentos.filter(d => d.numero !== 14)
      : this.documentos;
  }

 
get camposDatosGenerales(): string[] {
  const tipo = this.comercioForm.getRawValue().tipoComercio;
  const nivel = this.comercioForm.getRawValue().nivel;
  const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);
  return this.datosGeneralesPorTipo[esSinTipo ? nivel : tipo] ?? [];
}






  get mostrarAdminTotal(): boolean { return this.modoReservaActual !== 'COMPLETO'; }
  get mostrarPerfilReserva(): boolean { return this.modoReservaActual !== 'NINGUNO'; }
  get mostrarReservaSplit(): boolean { return this.modoReservaActual === 'TRANSACCIONAL'; }
  get mostrarPinSupervisor(): boolean { return this.accesosForm.controls.tieneSupervisor.value === 'si'; }
  get pasoActualLabel(): string { return this.pasos[this.pasoActual - 1]?.titulo ?? 'Validación'; }
  get documentosCargados(): number { return this.documentosVisibles.filter(d => !!(d.archivo || d.archivoNombre)).length; }
  get documentosPendientes(): number { return this.documentosVisibles.filter(d => d.obligatorio && !d.archivo).length; }

  get girosFiltrados() {
    const valor = this.busquedaGiroForm.getRawValue().termino.trim().toLowerCase();
    if (!valor) return this.girosSugeridos;
    return this.girosSugeridos.filter(g =>
      [g.familia, g.descripcion, g.mcc].some(v => v.toLowerCase().includes(valor))
    );
  }

  // ── Navegación ───────────────────────────────────────────────────────────────
  irAlPaso(paso: number): void {
    this.pasoActual = paso as PasoWizard;
    this.registroTerminado = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volver(paso: PasoWizard): void { this.irAlPaso(paso); }
  esPasoCompletado(paso: number): boolean { return this.pasosCompletados.has(paso) || this.pasoActual > paso; }
  private marcarPasoCompletado(paso: number): void { this.pasosCompletados.add(paso); }

  // ── Continuar ─────────────────────────────────────────────────────────────────
  continuarAfiliacion(): void {
    if (this.afiliacionForm.invalid) { this.afiliacionForm.markAllAsTouched(); return; }
    this.guardarBorradorSilencioso(); this.irAlPaso(1);
  }

  continuarComercio(): void {
    if (this.comercioForm.invalid) { this.comercioForm.markAllAsTouched(); return; }
    this.marcarPasoCompletado(1); this.guardarBorradorSilencioso(); this.irAlPaso(2);
  }

  continuarDatos(): void {
    if (this.datosForm.invalid) { this.datosForm.markAllAsTouched(); return; }
    this.marcarPasoCompletado(2); this.guardarBorradorSilencioso(); this.irAlPaso(3);
  }

  continuarAccesos(): void {
    this.accesosForm.markAllAsTouched();
    if (this.accesosForm.invalid) return;
    this.marcarPasoCompletado(3); this.guardarBorradorSilencioso(); this.irAlPaso(4);
  }

  continuarLiquidacion(): void {
    if (this.liquidacionForm.invalid) { this.liquidacionForm.markAllAsTouched(); return; }
    this.marcarPasoCompletado(4); this.guardarBorradorSilencioso(); this.irAlPaso(5);
  }

  finalizarRegistro(): void {
    const pasoInvalido = this.primerPasoInvalido();
    if (pasoInvalido !== null) { this.pasoActual = pasoInvalido; this.registroTerminado = false; return; }
    const faltantes = this.documentosVisibles.filter(d => d.obligatorio && !d.archivo);
    this.archivosInvalidos = faltantes.length > 0;
    if (this.archivosInvalidos) { this.pasoActual = 5; return; }
    this.marcarPasoCompletado(5);
    this.registroTerminado = true;
    this.guardarBorradorSilencioso();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private primerPasoInvalido(): PasoWizard | null {
    if (this.afiliacionForm.invalid) return 0;
    if (this.comercioForm.invalid) return 1;
    if (this.datosForm.invalid) return 2;
    if (this.accesosForm.invalid) return 3;
    if (this.liquidacionForm.invalid) return 4;
    return null;
  }

  // ── Resumen ───────────────────────────────────────────────────────────────────
  resumenPaso(paso: number): string {
    switch (paso) {
      case 1: return this.comercioForm.value.nivel || this.comercioForm.value.tipoComercio
        ? `${this.comercioForm.value.nivel || 'Nivel pendiente'} · ${this.comercioForm.value.tipoComercio || 'Tipo pendiente'}`
        : 'Descripción del comercio pendiente';
      case 2: return this.datosForm.value.razonSocial || this.datosForm.value.rfc
        ? `${this.datosForm.value.razonSocial || 'Razón social pendiente'} · ${this.datosForm.value.rfc || 'NIT pendiente'}`
        : 'Datos generales pendientes';
      case 3: return `Modo ${this.accesosForm.value.modoReserva || 'sin definir'} · ${this.accesosForm.value.cajasTPV || '1'} caja(s)`;
      case 4: return this.datosBeneficiarioIgualComercio
        ? 'Beneficiario sincronizado con el comercio'
        : `${this.liquidacionForm.value.nombreBeneficiario || 'Beneficiario pendiente'} · ${this.liquidacionForm.value.tipoCuenta || 'Cuenta pendiente'}`;
      case 5: return `${this.documentosCargados} de ${this.documentosVisibles.length} documentos cargados`;
      default: return 'Paso pendiente';
    }
  }

  esInvalido(formulario: 'afiliacion' | 'comercio' | 'datos' | 'accesos' | 'liquidacion' | 'comisionista', campo: string): boolean {
    const map: Record<string, any> = {
      afiliacion: this.afiliacionForm,
      comercio: this.comercioForm,
      datos: this.datosForm,
      accesos: this.accesosForm,
      liquidacion: this.liquidacionForm,
      comisionista: this.comisionistaForm,
    };
    const control = map[formulario]?.get(campo);
    return !!(control?.invalid && control.touched);
  }

  // ── Archivos ──────────────────────────────────────────────────────────────────
  seleccionarArchivo(event: Event, documento: DocumentoRequerido): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const valido = !!archivo && archivo.size <= 10 * 1024 * 1024 &&
      ['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type);
    if (!valido) {
      documento.archivo = undefined; documento.archivoNombre = undefined;
      input.value = ''; this.archivosInvalidos = true; return;
    }
    documento.archivo = archivo; documento.archivoNombre = archivo.name;
    this.archivosInvalidos = false;
    this.guardarBorradorSilencioso();
  }

  // ── Comisionista ──────────────────────────────────────────────────────────────
  guardarComisionista(): void {
    this.comisionistaForm.markAllAsTouched();
    const val = this.comisionistaForm.getRawValue();
    if (val.tipo === 'existente') {
      if (!val.afiliacion.trim()) {
        this.comisionistaForm.controls.afiliacion.setErrors({ required: true });
        this.comisionistaForm.controls.afiliacion.markAsTouched(); return;
      }
      this.comercioForm.patchValue({ afiliacionComisionista: val.afiliacion });
    } else {
      if (this.comisionistaForm.invalid) return;
      const nombre = [val.nombre, val.paterno, val.materno].filter(Boolean).join(' ');
      this.comercioForm.patchValue({ afiliacionComisionista: `Nuevo: ${nombre || 'comisionista'}` });
    }
    this.mostrarComisionista = false;
    this.guardarBorradorSilencioso();
  }

  // ── Giro comercial ────────────────────────────────────────────────────────────
  seleccionarGiro(giro: { mcc: string; descripcion: string }): void {
    this.busquedaGiroForm.patchValue({ resultado: giro.mcc });
  }

  guardarGiro(): void {
    const { resultado } = this.busquedaGiroForm.getRawValue();
    const giro = this.girosFiltrados.find(g => g.mcc === resultado);
    if (!giro) return;
    this.datosForm.patchValue({ descripcionGiro: giro.descripcion, mcc: giro.mcc });
    this.mostrarBusquedaGiro = false;
    this.guardarBorradorSilencioso();
  }

  // ── Ayuda / flujo ─────────────────────────────────────────────────────────────
  abrirAyuda(): void { this.mostrarAyuda = true; }
  cerrarAyuda(): void { this.mostrarAyuda = false; }

  reiniciarFlujo(): void {
    this.pasoActual = 0; this.pasosCompletados.clear();
    this.registroTerminado = false; this.archivosInvalidos = false;
    this.borradorGuardado = false; this.mostrarAyuda = false;
    this.mostrarComisionista = false; this.mostrarBusquedaGiro = false;

    this.afiliacionForm.reset({ afiliacion: '' });
    this.comercioForm.reset({ nivel: '', tipoComercio: '', afiliacionComisionista: '' });
    this.comisionistaForm.reset({ tipo: 'existente', afiliacion: '', correo: '', confirmarCorreo: '', telefono: '', nombre: '', paterno: '', materno: '', rfc: '' });
    this.datosForm.reset({ razonSocial: '', nombreComercial: '', rfc: '', regimenFiscal: '', giroComercial: '', descripcionGiro: '', mcc: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '', curp: '', actividad: '', tipoPersona: '', correo: '', telefono: '', departamento: '', ciudad: '', direccionComercial: '' });
    this.accesosForm.reset({ modoReserva: 'NINGUNO', cajasTPV: '1', tieneSupervisor: 'si', reservaSplit: '', adminNombre: '', adminPaterno: '', adminMaterno: '', adminCorreo: '', adminConfirmarCorreo: '', adminTelefono: '', perfilReservaNombre: '', perfilReservaPaterno: '', perfilReservaMaterno: '', perfilReservaCorreo: '', perfilReservaConfirmarCorreo: '', perfilReservaTelefono: '', pinAdministrador: '', pinCorreo: '', pinConfirmarCorreo: '', pinContrasena: '' });
    this.liquidacionForm.reset({ tipoPersonaBeneficiario: 'fisica', beneficiarioIgualComercio: false, nombreBeneficiario: '', apellidoPaternoBeneficiario: '', apellidoMaternoBeneficiario: '', correoBeneficiario: '', direccionBeneficiario: '', rfcBeneficiario: '', actividadBeneficiario: '', giroBeneficiario: '', tipoCuenta: '', cuentaClabe: '', nombreBanco: '', direccionBanco: '', telefonoBanco: '', emailBanco: '' });
    this.documentos.forEach(d => { d.archivo = undefined; d.archivoNombre = undefined; });
    this.actualizarValidadoresAccesos('NINGUNO');
    this.actualizarEstadoLiquidacion(false);
    try { localStorage.removeItem(this.draftKey); } catch { /* no-op */ }
  }

  // ── Borrador ──────────────────────────────────────────────────────────────────
  guardarBorrador(): void {
    this.guardarBorradorSilencioso();
    this.borradorGuardado = true;
    setTimeout(() => (this.borradorGuardado = false), 2200);
  }



  private guardarBorradorSilencioso(): void {
    try {
      localStorage.setItem(this.draftKey, JSON.stringify({
        pasoActual: this.pasoActual,
        pasosCompletados: [...this.pasosCompletados],
        registroTerminado: this.registroTerminado,
        afiliacion: this.afiliacionForm.getRawValue(),
        comercio: this.comercioForm.getRawValue(),
        comisionista: this.comisionistaForm.getRawValue(),
        datos: this.datosForm.getRawValue(),
        accesos: this.accesosForm.getRawValue(),
        liquidacion: this.liquidacionForm.getRawValue(),
        documentos: this.documentos.map(d => ({ numero: d.numero, archivoNombre: d.archivoNombre })),
      } as BorradorPreRegistro));
    } catch { /* no-op */ }
  }

  private cargarBorrador(): void {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<BorradorPreRegistro>;
      if (!draft) return;
      if (draft.afiliacion) this.afiliacionForm.patchValue(draft.afiliacion);
      if (draft.comercio) this.comercioForm.patchValue(draft.comercio);
      if (draft.comisionista) this.comisionistaForm.patchValue(draft.comisionista);
      if (draft.datos) this.datosForm.patchValue(draft.datos as any);
      if (draft.accesos) this.accesosForm.patchValue(draft.accesos as any);
      if (draft.liquidacion) this.liquidacionForm.patchValue(draft.liquidacion as any);
      this.documentos.forEach(d => {
        const saved = draft.documentos?.find(s => s.numero === d.numero);
        d.archivoNombre = saved?.archivoNombre;
        d.archivo = undefined;
      });
      this.pasoActual = (draft.pasoActual ?? 0) as PasoWizard;
      this.pasosCompletados = new Set(draft.pasosCompletados ?? []);
      this.registroTerminado = draft.registroTerminado ?? false;
      if (this.registroTerminado) { this.pasoActual = 5; this.pasosCompletados.add(5); }
      this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value as ModoReserva);
      this.actualizarEstadoLiquidacion(this.liquidacionForm.controls.beneficiarioIgualComercio.value);
      if (this.datosBeneficiarioIgualComercio) this.sincronizarBeneficiarioDesdeComercio();
    } catch {
      try { localStorage.removeItem(this.draftKey); } catch { /* no-op */ }
    }
  }

  private copiarDomicilioFiscal(): void {

    this.datosForm.patchValue({

      codigoPostalComercial: this.datosForm.value.codigoPostal,
      tipoVialidadComercial: this.datosForm.value.tipoVialidad,
      nombreVialidadComercial: this.datosForm.value.nombreVialidad,
      numeroExteriorComercial: this.datosForm.value.numeroExterior,
      numeroInteriorComercial: this.datosForm.value.numeroInterior,
      coloniaComercial: this.datosForm.value.colonia,
      localidadComercial: this.datosForm.value.localidad,
      municipioComercial: this.datosForm.value.municipio,
      entidadFederativaComercial: this.datosForm.value.entidadFederativa,
      entreCalleComercial: this.datosForm.value.entreCalle,
      yCalleComercial: this.datosForm.value.yCalle

    }, { emitEvent: false });

  }


  // ── Validadores y lógica de accesos/liquidación (sin cambios) ─────────────────
  private camposCoincidenValidator(campo: string, confirmacion: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.get(campo)?.value ?? ''}`.trim();
      const conf = `${control.get(confirmacion)?.value ?? ''}`.trim();
      if (!valor || !conf) return null;
      return valor === conf ? null : { [errorKey]: true };
    };
  }

  private rangoSplitReservaValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.get('modoReserva')?.value !== 'TRANSACCIONAL') return null;
      const split = Number(`${control.get('reservaSplit')?.value ?? ''}`.trim());
      return Number.isFinite(split) && split > 0 && split < 100 ? null : { rangoSplitInvalido: true };
    };
  }

  private setValidators(control: AbstractControl, validators: ValidatorFn[] = []): void {
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private togglarControl(control: AbstractControl, visible: boolean, validators: ValidatorFn[] = []): void {
    if (visible) { control.enable({ emitEvent: false }); this.setValidators(control, validators); return; }
    control.clearValidators(); control.disable({ emitEvent: false }); control.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarValidadoresAccesos(modoReserva: ModoReserva): void {
    this.modoReservaActual = modoReserva;
    const adminActivos = modoReserva !== 'COMPLETO';
    const perfilActivos = modoReserva !== 'NINGUNO';
    const splitActivos = modoReserva === 'TRANSACCIONAL';
    const supervisorActivos = this.accesosForm.controls.tieneSupervisor.value === 'si';

    this.togglarControl(this.accesosForm.controls.adminNombre, adminActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminPaterno, adminActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminMaterno, adminActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminCorreo, adminActivos, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.adminConfirmarCorreo, adminActivos, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.adminTelefono, adminActivos, [Validators.required, Validators.pattern(/^\d{10}$/)]);
    this.togglarControl(this.accesosForm.controls.perfilReservaNombre, perfilActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.perfilReservaPaterno, perfilActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.perfilReservaMaterno, perfilActivos, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.perfilReservaCorreo, perfilActivos, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.perfilReservaConfirmarCorreo, perfilActivos, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.perfilReservaTelefono, perfilActivos, [Validators.required, Validators.pattern(/^\d{10}$/)]);
    this.togglarControl(this.accesosForm.controls.reservaSplit, splitActivos, splitActivos ? [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,2})?$/)] : []);
    this.togglarControl(this.accesosForm.controls.pinAdministrador, supervisorActivos, supervisorActivos ? [Validators.required] : []);
    this.togglarControl(this.accesosForm.controls.pinCorreo, supervisorActivos, supervisorActivos ? [Validators.required, Validators.email] : []);
    this.togglarControl(this.accesosForm.controls.pinConfirmarCorreo, supervisorActivos, supervisorActivos ? [Validators.required, Validators.email] : []);
    this.togglarControl(this.accesosForm.controls.pinContrasena, supervisorActivos, supervisorActivos ? [Validators.required, Validators.minLength(6)] : []);
    this.accesosForm.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarEstadoLiquidacion(igualComercio: boolean): void {
    this.datosBeneficiarioIgualComercio = igualComercio;
    const controles = [
      this.liquidacionForm.controls.tipoPersonaBeneficiario,
      this.liquidacionForm.controls.nombreBeneficiario,
      this.liquidacionForm.controls.apellidoPaternoBeneficiario,
      this.liquidacionForm.controls.apellidoMaternoBeneficiario,
      this.liquidacionForm.controls.correoBeneficiario,
      this.liquidacionForm.controls.direccionBeneficiario,
      this.liquidacionForm.controls.rfcBeneficiario,
      this.liquidacionForm.controls.actividadBeneficiario,
      this.liquidacionForm.controls.giroBeneficiario,
    ];
    controles.forEach(c => igualComercio ? c.disable({ emitEvent: false }) : c.enable({ emitEvent: false }));
    if (igualComercio) this.sincronizarBeneficiarioDesdeComercio();
    this.liquidacionForm.updateValueAndValidity({ emitEvent: false });
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const d = this.datosForm.getRawValue();
    this.tipoPersonaBeneficiario = d.tipoPersona === 'Natural' ? 'fisica' : 'moral';
    const direccion = d.direccionComercial || [d.ciudad, d.departamento].filter(Boolean).join(', ');
    this.liquidacionForm.patchValue({
      nombreBeneficiario: d.razonSocial || d.nombreComercial || '',
      apellidoPaternoBeneficiario: '', apellidoMaternoBeneficiario: '',
      correoBeneficiario: d.correo || '',
      direccionBeneficiario: direccion,
      actividadBeneficiario: '', giroBeneficiario: '',
    }, { emitEvent: false });
  }
}