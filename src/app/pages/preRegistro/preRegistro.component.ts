import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggleButtonComponent } from '../../shared/components/common/theme-toggle/theme-toggle-button.component';

type PasoWizard = 0 | 1 | 2 | 3 | 4 | 5;
type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type TipoComisionista = 'existente' | 'nuevo';

interface DocumentoRequerido {
  numero: number;
  nombre: string;
  obligatorio: boolean;
  archivo?: File;
  archivoNombre?: string;
}

interface BorradorPreRegistro {
  pasoActual: PasoWizard;
  pasosCompletados: number[];
  registroTerminado: boolean;
  afiliacion: { afiliacion: string };
  comercio: {
    nivel: string;
    tipoComercio: string;
    afiliacionComisionista: string;
  };
  comisionista: Record<string, string>;
  datos: Record<string, string>;
  accesos: Record<string, string>;
  liquidacion: Record<string, string | boolean>;
  documentos: Array<{ numero: number; archivoNombre?: string }>;
}

@Component({
  selector: 'app-preregistro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ThemeToggleButtonComponent],
  templateUrl: './preRegistro.component.html',
  styleUrls: ['./preRegistro.component.css'],
})
export class PreRegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftStorageKey = 'kashpay.preregistro.draft.v1';

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

  readonly pasos = [
    {
      numero: 1,
      titulo: 'Descripción del Comercio',
      //descripcion: 'Nivel, tipo de comercio y comisionista.',
    },
    {
      numero: 2,
      titulo: 'Datos Generales',
      //descripcion: 'Información fiscal, giro y domicilio.',
    },
    {
      numero: 3,
      titulo: 'Accesos a la Plataforma y Terminales TPV',
     // descripcion: 'Modo de reserva, administradores y cajas.',
    },
    {
      numero: 4,
      titulo: 'Cuenta para Liquidación',
     // descripcion: 'Beneficiario y datos bancarios.',
    },
    {
      numero: 5,
      titulo: 'Documentos del Comercio',
     // descripcion: 'Carga la documentación requerida.',
    },
  ];

  readonly requisitos = [
    'Acta constitutiva para persona moral.',
    'Poder vigente del representante legal.',
    'Constancia de situación fiscal reciente y completa.',
    'Identificación oficial vigente del representante legal. (INE y /o PASAPORTE VIGENTE)',
    'Datos de contacto del mismo representante legal. (Teléfono oficina, celular y correo electronico)',
    'Relación y contactos de las personas responsables en el proyecto.',
    'Comprobante de domicilio no mayor a 3 meses.',
    'Correo electrónico y teléfono móvil activos.'
  ];

  readonly niveles = [
    'Sub Afiliado',
    'Entidad',
    'Sucursal',
    'Caja',
    'Referenciador',
    'Promotor',
    'Comisionista',
  ];

  readonly tiposComercio = [
    'Empresa Grupo',
    'Persona Física',
    'Empresa Agrupadora',
    'Entidad Agrupadora',
    'Sucursal',
    'Caja',
  ];

  readonly tiposPersona = ['Jurídica', 'Natural'];
  readonly departamentos = ['Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Atlántico'];
  readonly ciudades = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla'];

  readonly modosReserva: ModoReserva[] = ['NINGUNO', 'MANUAL', 'TRANSACCIONAL', 'AUTOMÁTICO', 'COMPLETO'];
  readonly tiposCuenta = ['CLABE', 'SPEI', 'Tarjeta'];
  readonly girosSugeridos = [
    { familia: 'Turismo', descripcion: 'Agencias de viajes', mcc: '4722' },
    { familia: 'Alimentos', descripcion: 'Restaurantes', mcc: '5812' },
    { familia: 'Comercio', descripcion: 'Tiendas de ropa', mcc: '5651' },
    { familia: 'Servicios', descripcion: 'Servicios profesionales', mcc: '8999' },
  ];

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

  readonly afiliacionForm = this.fb.nonNullable.group({
    afiliacion: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
  });

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: [''],
  });

  readonly datosForm = this.fb.nonNullable.group(
    {
      razonSocial: ['', Validators.required],
      nit: ['', [Validators.required, Validators.pattern(/^[0-9.\-]{7,20}$/)]],
      nombreComercial: ['', Validators.required],
      tipoPersona: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9\s()+-]{7,20}$/)]],
      departamento: ['', Validators.required],
      ciudad: ['', Validators.required],
      direccionComercial: ['', Validators.required],
    },
  );

  readonly accesosForm = this.fb.nonNullable.group({
    modoReserva: ['NINGUNO' as ModoReserva, Validators.required],
    reservaSplit: [''],
    adminNombre: ['', Validators.required],
    adminPaterno: ['', Validators.required],
    adminMaterno: ['', Validators.required],
    adminCorreo: ['', [Validators.required, Validators.email]],
    adminConfirmarCorreo: ['', [Validators.required, Validators.email]],
    adminTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    perfilReservaNombre: [''],
    perfilReservaPaterno: [''],
    perfilReservaMaterno: [''],
    perfilReservaCorreo: [''],
    perfilReservaConfirmarCorreo: [''],
    perfilReservaTelefono: [''],
    cajasTPV: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    tieneSupervisor: ['si', Validators.required],
    pinAdministrador: [''],
    pinCorreo: [''],
    pinConfirmarCorreo: [''],
    pinContrasena: [''],
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
    nombreBeneficiario: ['', Validators.required],
    apellidoPaternoBeneficiario: ['', Validators.required],
    apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]],
    direccionBeneficiario: ['', Validators.required],
    rfcBeneficiario: ['', Validators.required],
    actividadBeneficiario: ['', Validators.required],
    giroBeneficiario: ['', Validators.required],
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', [Validators.required, Validators.pattern(/^\d{18}$/)]],
    nombreBanco: ['', Validators.required],
    direccionBanco: ['', Validators.required],
    telefonoBanco: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    emailBanco: ['', [Validators.required, Validators.email]],
  });

  readonly busquedaGiroForm = this.fb.nonNullable.group({
    termino: [''],
    resultado: [''],
  });

  readonly comisionistaForm = this.fb.nonNullable.group({
    tipo: ['existente' as TipoComisionista, Validators.required],
    afiliacion: [''],
    correo: [''],
    confirmarCorreo: [''],
    telefono: [''],
    nombre: [''],
    paterno: [''],
    materno: [''],
    rfc: [''],
  }, {
    validators: [this.camposCoincidenValidator('correo', 'confirmarCorreo', 'comisionistaCorreosDistintos')],
  });

  constructor() {
    this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value);
    this.actualizarEstadoLiquidacion(this.liquidacionForm.controls.beneficiarioIgualComercio.value);

    this.accesosForm.controls.modoReserva.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modo) => this.actualizarValidadoresAccesos(modo as ModoReserva));

    this.accesosForm.controls.tieneSupervisor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value));

    this.liquidacionForm.controls.beneficiarioIgualComercio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => this.actualizarEstadoLiquidacion(checked));

    this.liquidacionForm.controls.tipoPersonaBeneficiario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => {
        this.tipoPersonaBeneficiario = tipo as TipoPersonaBeneficiario;
      });

    this.comercioForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.datosBeneficiarioIgualComercio) {
          this.sincronizarBeneficiarioDesdeComercio();
        }
      });

    this.datosForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.datosBeneficiarioIgualComercio) {
          this.sincronizarBeneficiarioDesdeComercio();
        }
      });

    this.cargarBorrador();
  }

  get progresoWizard(): number {
    if (this.pasoActual === 0) return 0;
    return ((this.pasoActual - 1) / (this.pasos.length - 1)) * 100;
  }

  get documentosVisibles(): DocumentoRequerido[] {
    return this.modoReservaActual === 'COMPLETO'
      ? this.documentos.filter((documento) => documento.numero !== 14)
      : this.documentos;
  }

  get mostrarAdminTotal(): boolean {
    return this.modoReservaActual !== 'COMPLETO';
  }

  get mostrarPerfilReserva(): boolean {
    return this.modoReservaActual !== 'NINGUNO';
  }

  get mostrarReservaSplit(): boolean {
    return this.modoReservaActual === 'TRANSACCIONAL';
  }

  get mostrarDocumentosCuenta(): boolean {
    return this.modoReservaActual !== 'COMPLETO';
  }

  get mostrarPinSupervisor(): boolean {
    return this.accesosForm.controls.tieneSupervisor.value === 'si';
  }

  get summaryModoReserva(): string {
    return this.accesosForm.controls.modoReserva.value;
  }

  get pasoActualLabel(): string {
    return this.pasos[this.pasoActual - 1]?.titulo ?? 'Validación';
  }

  get documentosCargados(): number {
    return this.documentosVisibles.filter((documento) => !!(documento.archivo || documento.archivoNombre)).length;
  }

  get documentosPendientes(): number {
    return this.documentosVisibles.filter((documento) => documento.obligatorio && !documento.archivo).length;
  }

  resumenPaso(paso: number): string {
    switch (paso) {
      case 1:
        return this.comercioForm.value.nivel || this.comercioForm.value.tipoComercio
          ? `${this.comercioForm.value.nivel || 'Nivel pendiente'} · ${this.comercioForm.value.tipoComercio || 'Tipo pendiente'}`
          : 'Descripción del comercio pendiente';
      case 2:
        return this.datosForm.value.razonSocial || this.datosForm.value.nit
          ? `${this.datosForm.value.razonSocial || 'Razón social pendiente'} · ${this.datosForm.value.nit || 'NIT pendiente'}`
          : 'Datos generales pendientes';
      case 3:
        return `Modo ${this.accesosForm.value.modoReserva || 'sin definir'} · ${this.accesosForm.value.cajasTPV || '1'} caja(s)`;
      case 4:
        return this.datosBeneficiarioIgualComercio
          ? 'Beneficiario sincronizado con el comercio'
          : `${this.liquidacionForm.value.nombreBeneficiario || 'Beneficiario pendiente'} · ${this.liquidacionForm.value.tipoCuenta || 'Cuenta pendiente'}`;
      case 5:
        return `${this.documentosCargados} de ${this.documentosVisibles.length} documentos cargados`;
      default:
        return 'Paso pendiente';
    }
  }

  private correosCoinciden(control: AbstractControl): ValidationErrors | null {
    const correo = control.get('correo')?.value;
    const confirmacion = control.get('confirmarCorreo')?.value;
    return correo && confirmacion && correo !== confirmacion ? { correosDistintos: true } : null;
  }

  private setValidators(control: AbstractControl, validators: ValidatorFn[] = []): void {
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private camposCoincidenValidator(campo: string, confirmacion: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.get(campo)?.value ?? ''}`.trim();
      const confirmacionValor = `${control.get(confirmacion)?.value ?? ''}`.trim();

      if (!valor || !confirmacionValor) {
        return null;
      }

      return valor === confirmacionValor ? null : { [errorKey]: true };
    };
  }

  private rangoSplitReservaValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const modoReserva = control.get('modoReserva')?.value as ModoReserva | undefined;
      if (modoReserva !== 'TRANSACCIONAL') {
        return null;
      }

      const valor = `${control.get('reservaSplit')?.value ?? ''}`.trim();
      const split = Number(valor);
      return Number.isFinite(split) && split > 0 && split < 100 ? null : { rangoSplitInvalido: true };
    };
  }

  private togglarControl(control: AbstractControl, visible: boolean, validators: ValidatorFn[] = []): void {
    if (visible) {
      control.enable({ emitEvent: false });
      this.setValidators(control, validators);
      return;
    }

    control.clearValidators();
    control.disable({ emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarValidadoresAccesos(modoReserva: ModoReserva): void {
    this.modoReservaActual = modoReserva;
    const adminActivos = modoReserva !== 'COMPLETO';
    const perfilActivos = modoReserva !== 'NINGUNO';
    const splitActivos = modoReserva === 'TRANSACCIONAL';
    const supervisorActivos = this.accesosForm.controls.tieneSupervisor.value === 'si';

    const adminValidators: ValidatorFn[] = [Validators.required];
    const adminEmailValidators: ValidatorFn[] = [Validators.required, Validators.email];
    const adminTelefonoValidators: ValidatorFn[] = [Validators.required, Validators.pattern(/^\d{10}$/)];
    const perfilValidators: ValidatorFn[] = [Validators.required];
    const perfilEmailValidators: ValidatorFn[] = [Validators.required, Validators.email];

    this.togglarControl(this.accesosForm.controls.adminNombre, adminActivos, adminValidators);
    this.togglarControl(this.accesosForm.controls.adminPaterno, adminActivos, adminValidators);
    this.togglarControl(this.accesosForm.controls.adminMaterno, adminActivos, adminValidators);
    this.togglarControl(this.accesosForm.controls.adminCorreo, adminActivos, adminEmailValidators);
    this.togglarControl(this.accesosForm.controls.adminConfirmarCorreo, adminActivos, adminEmailValidators);
    this.togglarControl(this.accesosForm.controls.adminTelefono, adminActivos, adminTelefonoValidators);

    this.togglarControl(this.accesosForm.controls.perfilReservaNombre, perfilActivos, perfilValidators);
    this.togglarControl(this.accesosForm.controls.perfilReservaPaterno, perfilActivos, perfilValidators);
    this.togglarControl(this.accesosForm.controls.perfilReservaMaterno, perfilActivos, perfilValidators);
    this.togglarControl(this.accesosForm.controls.perfilReservaCorreo, perfilActivos, perfilEmailValidators);
    this.togglarControl(this.accesosForm.controls.perfilReservaConfirmarCorreo, perfilActivos, perfilEmailValidators);
    this.togglarControl(this.accesosForm.controls.perfilReservaTelefono, perfilActivos, adminTelefonoValidators);

    this.togglarControl(
      this.accesosForm.controls.reservaSplit,
      splitActivos,
      splitActivos ? [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,2})?$/)] : [],
    );

    this.togglarControl(
      this.accesosForm.controls.pinAdministrador,
      supervisorActivos,
      supervisorActivos ? [Validators.required] : [],
    );
    this.togglarControl(
      this.accesosForm.controls.pinCorreo,
      supervisorActivos,
      supervisorActivos ? [Validators.required, Validators.email] : [],
    );
    this.togglarControl(
      this.accesosForm.controls.pinConfirmarCorreo,
      supervisorActivos,
      supervisorActivos ? [Validators.required, Validators.email] : [],
    );
    this.togglarControl(
      this.accesosForm.controls.pinContrasena,
      supervisorActivos,
      supervisorActivos ? [Validators.required, Validators.minLength(6)] : [],
    );

    this.accesosForm.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarEstadoLiquidacion(igualComercio: boolean): void {
    this.datosBeneficiarioIgualComercio = igualComercio;

    const controlesBeneficiario = [
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

    controlesBeneficiario.forEach((control) => {
      if (igualComercio) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });

    if (igualComercio) {
      this.sincronizarBeneficiarioDesdeComercio();
    }

    this.liquidacionForm.updateValueAndValidity({ emitEvent: false });
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const datos = this.datosForm.getRawValue();
    const tipoPersona: TipoPersonaBeneficiario = datos.tipoPersona === 'Natural' ? 'fisica' : 'moral';
    this.tipoPersonaBeneficiario = tipoPersona;

    const direccion = datos.direccionComercial || [datos.ciudad, datos.departamento].filter(Boolean).join(', ');

    this.liquidacionForm.patchValue(
      {
        tipoPersonaBeneficiario: tipoPersona,
        nombreBeneficiario: datos.razonSocial || datos.nombreComercial || '',
        apellidoPaternoBeneficiario: '',
        apellidoMaternoBeneficiario: '',
        correoBeneficiario: datos.correo || '',
        direccionBeneficiario: direccion,
        rfcBeneficiario: datos.nit || '',
        actividadBeneficiario: '',
        giroBeneficiario: '',
      },
      { emitEvent: false },
    );
  }

  private capturarDocumento(event: Event, documento: DocumentoRequerido): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const esArchivoPermitido =
      !!archivo &&
      archivo.size <= 10 * 1024 * 1024 &&
      ['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type);

    if (!esArchivoPermitido) {
      documento.archivo = undefined;
      documento.archivoNombre = undefined;
      input.value = '';
      this.archivosInvalidos = true;
      return;
    }

    documento.archivo = archivo;
    documento.archivoNombre = archivo?.name;
    this.archivosInvalidos = false;
  }

  private marcarPasoCompletado(paso: number): void {
    this.pasosCompletados.add(paso);
  }

  private primerPasoInvalido(): PasoWizard | null {
    if (this.afiliacionForm.invalid) return 0;
    if (this.comercioForm.invalid) return 1;
    if (this.datosForm.invalid) return 2;
    if (this.accesosForm.invalid) return 3;
    if (this.liquidacionForm.invalid) return 4;
    return null;
  }

  irAlPaso(paso: number): void {
    this.pasoActual = paso as PasoWizard;
    this.registroTerminado = false;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  continuarAfiliacion(): void {
    if (this.afiliacionForm.invalid) {
      this.afiliacionForm.markAllAsTouched();
      return;
    }

    this.guardarBorradorSilencioso(false);
    this.irAlPaso(1);
  }

  continuarComercio(): void {
    if (this.comercioForm.invalid) {
      this.comercioForm.markAllAsTouched();
      return;
    }

    this.marcarPasoCompletado(1);
    this.guardarBorradorSilencioso(false);
    this.irAlPaso(2);
  }

  continuarDatos(): void {
    if (this.datosForm.invalid) {
      this.datosForm.markAllAsTouched();
      return;
    }

    this.marcarPasoCompletado(2);
    this.guardarBorradorSilencioso(false);
    this.irAlPaso(3);
  }

  continuarAccesos(): void {
    this.accesosForm.markAllAsTouched();

    if (this.accesosForm.invalid) {
      return;
    }

    this.marcarPasoCompletado(3);
    this.guardarBorradorSilencioso(false);
    this.irAlPaso(4);
  }

  continuarLiquidacion(): void {
    if (this.liquidacionForm.invalid) {
      this.liquidacionForm.markAllAsTouched();
      return;
    }

    this.marcarPasoCompletado(4);
    this.guardarBorradorSilencioso(false);
    this.irAlPaso(5);
  }

  finalizarRegistro(): void {
    const pasoInvalido = this.primerPasoInvalido();
    if (pasoInvalido !== null) {
      this.pasoActual = pasoInvalido;
      this.registroTerminado = false;
      return;
    }

    const documentosFaltantes = this.documentosVisibles.filter(
      (documento) => documento.obligatorio && !documento.archivo,
    );
    this.archivosInvalidos = documentosFaltantes.length > 0;
    if (this.archivosInvalidos) {
      this.pasoActual = 5;
      return;
    }

    this.marcarPasoCompletado(5);
    this.registroTerminado = true;
    this.guardarBorradorSilencioso(false);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  volver(paso: PasoWizard): void {
    this.irAlPaso(paso);
  }

  toggleSeccion(seccion: 'comercio' | 'generales'): void {
    this.mostrarBusquedaGiro = false;
  }

  seleccionarArchivo(event: Event, documento: DocumentoRequerido): void {
    this.capturarDocumento(event, documento);
    this.guardarBorradorSilencioso(false);
  }

  guardarComisionista(): void {
    this.comisionistaForm.markAllAsTouched();
    const valor = this.comisionistaForm.getRawValue();
    if (valor.tipo === 'existente') {
      if (!valor.afiliacion.trim()) {
        this.comisionistaForm.controls.afiliacion.setErrors({ required: true });
        this.comisionistaForm.controls.afiliacion.markAsTouched();
        return;
      }
      this.comercioForm.patchValue({ afiliacionComisionista: valor.afiliacion || '' });
    } else if (this.comisionistaForm.invalid) {
      return;
    } else {
      const nombre = [valor.nombre, valor.paterno, valor.materno].filter(Boolean).join(' ');
      this.comercioForm.patchValue({
        afiliacionComisionista: `Nuevo: ${nombre || 'comisionista'}`,
      });
    }

    this.mostrarComisionista = false;
    this.guardarBorradorSilencioso(false);
  }

  seleccionarGiro(giro: (typeof this.girosSugeridos)[number]): void {
    this.busquedaGiroForm.patchValue({ resultado: giro.mcc });
  }

  guardarGiro(): void {
    const { resultado } = this.busquedaGiroForm.getRawValue();
    if (!resultado) return;

    const giro = this.girosFiltrados.find((item) => item.mcc === resultado);
    if (!giro) return;

    this.datosForm.patchValue({
     // familiaGiro: giro.familia,
     // descripcionGiro: giro.descripcion,
     // mcc: giro.mcc,
    });
    this.mostrarBusquedaGiro = false;
    this.guardarBorradorSilencioso(false);
  }

  get girosFiltrados() {
    const { termino } = this.busquedaGiroForm.getRawValue();
    const valor = termino.trim().toLowerCase();
    if (!valor) return this.girosSugeridos;

    return this.girosSugeridos.filter((giro) =>
      [giro.familia, giro.descripcion, giro.mcc].some((item) => item.toLowerCase().includes(valor)),
    );
  }

  esPasoCompletado(paso: number): boolean {
    return this.pasosCompletados.has(paso) || this.pasoActual > paso;
  }

  esInvalido(
    formulario: 'afiliacion' | 'comercio' | 'datos' | 'accesos' | 'liquidacion' | 'comisionista',
    campo: string,
  ): boolean {
    const form: FormGroup =
      formulario === 'afiliacion'
        ? this.afiliacionForm
        : formulario === 'comercio'
          ? this.comercioForm
          : formulario === 'datos'
            ? this.datosForm
            : formulario === 'accesos'
              ? this.accesosForm
              : this.liquidacionForm;

    const control = form.get(campo);
    return !!(control?.invalid && control.touched);
  }

  guardarBorrador(): void {
    this.guardarBorradorSilencioso(true);
  }

  abrirAyuda(): void {
    this.mostrarAyuda = true;
  }

  cerrarAyuda(): void {
    this.mostrarAyuda = false;
  }

  reiniciarFlujo(): void {
    this.pasoActual = 0;
    this.pasosCompletados.clear();
    this.registroTerminado = false;
    this.archivosInvalidos = false;
    this.borradorGuardado = false;
    this.mostrarAyuda = false;
    this.mostrarComisionista = false;
    this.mostrarBusquedaGiro = false;

    this.afiliacionForm.reset({ afiliacion: '' });
    this.comercioForm.reset({ nivel: '', tipoComercio: '', afiliacionComisionista: '' });
    this.comisionistaForm.reset({
      tipo: 'existente',
      afiliacion: '',
      correo: '',
      confirmarCorreo: '',
      telefono: '',
      nombre: '',
      paterno: '',
      materno: '',
      rfc: '',
    });
    this.datosForm.reset({
      razonSocial: '',
      nit: '',
      nombreComercial: '',
      tipoPersona: '',
      correo: '',
      telefono: '',
      departamento: '',
      ciudad: '',
      direccionComercial: '',
    });
    this.accesosForm.reset({
      modoReserva: 'NINGUNO',
      reservaSplit: '',
      adminNombre: '',
      adminPaterno: '',
      adminMaterno: '',
      adminCorreo: '',
      adminConfirmarCorreo: '',
      adminTelefono: '',
      perfilReservaNombre: '',
      perfilReservaPaterno: '',
      perfilReservaMaterno: '',
      perfilReservaCorreo: '',
      perfilReservaConfirmarCorreo: '',
      perfilReservaTelefono: '',
      cajasTPV: '1',
      tieneSupervisor: 'si',
      pinAdministrador: '',
      pinCorreo: '',
      pinConfirmarCorreo: '',
      pinContrasena: '',
    });
    this.liquidacionForm.reset({
      tipoPersonaBeneficiario: 'fisica',
      beneficiarioIgualComercio: false,
      nombreBeneficiario: '',
      apellidoPaternoBeneficiario: '',
      apellidoMaternoBeneficiario: '',
      correoBeneficiario: '',
      direccionBeneficiario: '',
      rfcBeneficiario: '',
      actividadBeneficiario: '',
      giroBeneficiario: '',
      tipoCuenta: '',
      cuentaClabe: '',
      nombreBanco: '',
      direccionBanco: '',
      telefonoBanco: '',
      emailBanco: '',
    });

    this.documentos.forEach((documento) => {
      documento.archivo = undefined;
      documento.archivoNombre = undefined;
    });

    this.actualizarValidadoresAccesos('NINGUNO');
    this.actualizarEstadoLiquidacion(false);
    this.limpiarBorrador();
  }

  private guardarBorradorSilencioso(mostrarConfirmacion = false): void {
    const borrador: BorradorPreRegistro = {
      pasoActual: this.pasoActual,
      pasosCompletados: [...this.pasosCompletados],
      registroTerminado: this.registroTerminado,
      afiliacion: this.afiliacionForm.getRawValue(),
      comercio: this.comercioForm.getRawValue(),
      comisionista: this.comisionistaForm.getRawValue(),
      datos: this.datosForm.getRawValue(),
      accesos: this.accesosForm.getRawValue(),
      liquidacion: this.liquidacionForm.getRawValue(),
      documentos: this.documentos.map((documento) => ({
        numero: documento.numero,
        archivoNombre: documento.archivoNombre,
      })),
    };

    try {
      localStorage.setItem(this.draftStorageKey, JSON.stringify(borrador));
      this.borradorGuardado = mostrarConfirmacion;
      if (mostrarConfirmacion && typeof window !== 'undefined') {
        window.setTimeout(() => (this.borradorGuardado = false), 2200);
      }
    } catch {
      this.borradorGuardado = false;
    }
  }

  private limpiarBorrador(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {
      // No-op.
    }
  }

  private cargarBorrador(): void {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return;

      const draft = JSON.parse(raw) as Partial<BorradorPreRegistro>;
      if (!draft) return;

      if (draft.afiliacion) this.afiliacionForm.patchValue(draft.afiliacion);
      if (draft.comercio) this.comercioForm.patchValue(draft.comercio);
      if (draft.comisionista) this.comisionistaForm.patchValue(draft.comisionista as Record<string, string>);
      if (draft.datos) this.datosForm.patchValue(draft.datos as Record<string, string>);
      if (draft.accesos) this.accesosForm.patchValue(draft.accesos as Record<string, string>);
      if (draft.liquidacion) {
        this.liquidacionForm.patchValue(draft.liquidacion as Record<string, string | boolean>);
      }

      this.documentos.forEach((documento) => {
        const saved = draft.documentos?.find((item) => item.numero === documento.numero);
        documento.archivoNombre = saved?.archivoNombre;
        documento.archivo = undefined;
      });

      this.pasoActual = (draft.pasoActual ?? 0) as PasoWizard;
      this.pasosCompletados = new Set(draft.pasosCompletados ?? []);
      this.registroTerminado = draft.registroTerminado ?? false;
      if (this.registroTerminado && this.pasoActual < 5) {
        this.pasoActual = 5;
      }
      if (this.registroTerminado) {
        this.pasosCompletados.add(5);
      }
      this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value);
      this.actualizarEstadoLiquidacion(this.liquidacionForm.controls.beneficiarioIgualComercio.value);

      if (this.datosBeneficiarioIgualComercio) {
        this.sincronizarBeneficiarioDesdeComercio();
      }
    } catch {
      this.limpiarBorrador();
    }
  }
}
