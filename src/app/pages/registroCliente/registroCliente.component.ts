import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StepAccesosComponent, UsuarioAccesoConfig } from '../preRegistro/components/accesos/step-accesos.component';
import { StepComercioComponent } from '../preRegistro/components/comercio/step-comercio.component';
import { StepDatosComponent } from '../preRegistro/components/datos-generales/step-datos.component';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';
import { StepLiquidacionComponent } from '../preRegistro/components/liquidacion/step-liquidacion.component';
import { DocumentoRequerido } from '../preRegistro/models/preregistro.models';
import { SipreladResultado, SipreladService } from '../../services/siprelad.service';
import {
  DocumentoProspectoApi,
  DocumentosProspectoResponse,
  DocumentosProspectoService,
  EstatusDocumentoProspecto
} from '../../services/documentos-prospecto.service';

type NivelNodo = 'sub-afiliado' | 'referenciador' | 'entidad' | 'sucursal' | 'caja';
type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type PrefijoAccesoRegistro = 'admin' | 'fac' | 'tkt' | 'controlador' | 'supervisor';

interface NodoRegistro {
  id: string;
  nombre: string;
  nivel: NivelNodo;
  hijos?: NodoRegistro[];
}

interface SeccionRegistro {
  id: 'comercio' | 'datos' | 'accesos' | 'liquidacion' | 'documentos';
  titulo: string;
  descripcion: string;
  icono: string;
}

@Component({
  selector: 'app-registro-cliente',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    StepComercioComponent,
    StepDatosComponent,
    StepAccesosComponent,
    StepLiquidacionComponent,
    StepDocumentosComponent
  ],
  templateUrl: './registroCliente.component.html',
  styleUrls: ['./registroCliente.component.css']
})
export class RegistroClienteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sipreladService = inject(SipreladService);
  private readonly documentosProspectoService = inject(DocumentosProspectoService);
  private readonly comerciosLocalesKey = 'kashpay.consulta_comercios.local.v1';
  private readonly registroLocalKey = 'kashpay.registro_cliente.local.v1';
  private readonly ocultarArbolRegistroTemporal = true;
  private readonly mostrarSoloPasosTresCincoRegistroTemporal = true;

  pasoActual = 3;
  seccionAbierta: SeccionRegistro['id'] | null = 'liquidacion';
  pasosCompletados = new Set<string>();
  nodoSeleccionado = 'entidad-1-sucursal-1-caja-3';
  nodosColapsados = new Set<string>();
  tipoPersonaBeneficiario: TipoPersonaBeneficiario = 'fisica';
  datosBeneficiarioIgualComercio = false;
  modoReservaActual: ModoReserva = 'NINGUNO';
  archivosInvalidos = false;
  pldID = '';
  cargandoSiprelad = false;
  resultadoSiprelad = 'No se encontraron registros relacionados con PLD';
  resultadosSiprelad: SipreladResultado[] = [];
  commerceID = '';
  documentosProspecto: DocumentoProspectoApi[] = [];
  cargandoDocumentosProspecto = false;
  guardandoRevisionDocumentos = false;
  errorDocumentosProspecto = '';
  observacionesInternasMesaDigital = '';
  tiposComercio: string[] = [];
  arbolMinimizado = false;
  usuarioAccesoActivo: PrefijoAccesoRegistro = 'admin';
  private comercioPorNodo: Record<string, ReturnType<typeof this.comercioForm.getRawValue>> = {};
  private datosPorNodo: Record<string, ReturnType<typeof this.datosForm.getRawValue>> = {};
  private accesosPorNodo: Record<string, ReturnType<typeof this.accesosForm.getRawValue>> = {};
  private liquidacionPorNodo: Record<string, ReturnType<typeof this.liquidacionForm.getRawValue>> = {};
  private nodosNuevos = new Set<string>();

  comercioSeleccionado = {
    idComercio: '',
    nivel: '',
    nombreComercial: '',
    rfc: '',
    correo: '',
    telefono: ''
  };

  contextoSeleccionado = {
    idComercio: '',
    nivel: '',
    nombreComercial: '',
    rfc: ''
  };

  readonly pasos = [
    { numero: 1, titulo: 'Descripción del Comercio' },
    { numero: 2, titulo: 'Datos Generales' },
    { numero: 3, titulo: 'Cuenta de Liquidación' },
    { numero: 4, titulo: 'Accesos a la Plataforma y Terminales TPV' },
    { numero: 5, titulo: 'Documentos del Comercio' }
  ];

  readonly secciones: SeccionRegistro[] = [
    { id: 'comercio', titulo: 'Datos del Comercio', descripcion: 'Información básica y de contacto del comercio', icono: 'fa-store' },
    { id: 'datos', titulo: 'Datos Generales', descripcion: 'Información del representante o contacto principal', icono: 'fa-user' },
    { id: 'liquidacion', titulo: 'Cuenta de Liquidación', descripcion: 'Datos de la cuenta donde se recibirán las liquidaciones', icono: 'fa-building-columns' },
    { id: 'accesos', titulo: 'Accesos a Plataforma y TPV', descripcion: 'Credenciales para acceso a la plataforma y uso del TPV', icono: 'fa-lock' },
    { id: 'documentos', titulo: 'Documentos', descripcion: 'Documentos requeridos del comercio', icono: 'fa-file-lines' }
  ];

  readonly niveles = ['Sub Afiliado', 'Entidad', 'Sucursal', 'Caja', 'Referenciador', 'Comisionista'];
  readonly tiposCuenta = ['CLABE', 'SPEI', 'Tarjeta'];
  readonly tiposPersona = ['Jurídica', 'Natural'];
  readonly departamentos = ['Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Atlántico'];
  readonly ciudades = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla'];
  readonly regimenesFiscales = [
    '601 - General de Ley Personas Morales',
    '603 - Personas Morales con Fines no Lucrativos',
    '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
    '612 - Personas Físicas con Actividades Empresariales y Profesionales',
    '626 - Régimen Simplificado de Confianza'
  ];
  readonly girosComerciales: string[] = [];
  readonly usuariosAccesoBase: Record<PrefijoAccesoRegistro, UsuarioAccesoConfig> = {
    admin: {
      prefijo: 'admin',
      titulo: 'Usuario Administrador',
      descripcion: 'con acceso a la plataforma y gestión general.',
      icono: 'fa-regular fa-user'
    },
    fac: {
      prefijo: 'fac',
      titulo: 'Usuario Administrador FAC',
      descripcion: 'con permisos para administración de facturación.',
      icono: 'fa-solid fa-file-invoice'
    },
    tkt: {
      prefijo: 'tkt',
      titulo: 'Usuario Administrador TKT',
      descripcion: 'con permisos para administración de tickets.',
      icono: 'fa-solid fa-ticket'
    },
    controlador: {
      prefijo: 'controlador',
      titulo: 'Usuario Controlador de Recursos',
      descripcion: 'para comercios tipo Agrupadora Controladora.',
      icono: 'fa-solid fa-user-gear'
    },
    supervisor: {
      prefijo: 'supervisor',
      titulo: 'Usuario Supervisor de Terminales',
      descripcion: 'para comercios tipo Agrupadora Supervisora.',
      icono: 'fa-solid fa-user-check'
    }
  };

  readonly tiposComercioPorNivel: Record<string, string[]> = {
    'Sub Afiliado': ['Empresa Holding'],
    'Entidad': ['Empresa Grupo', 'Persona Física'],
    'Sucursal': ['Sucursales de Grupo', 'Sucursal Persona Física', 'Sucursales Únicas'],
    'Caja': ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'],
    'Referenciador': [],
    'Comisionista': []
  };

  readonly datosGeneralesPorTipo: Record<string, string[]> = {
    'Empresa Grupo': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Persona Física': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Empresa Holding': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales de Grupo': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursal Persona Física': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales Únicas': ['rfc', 'razonSocial', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Caja con Tarjeta sólo Fondeo': [],
    'Caja con Tarjeta SPEI': [],
    'Cuenta Entidad': [],
    'Cuenta Terminal': [],
    'Cuenta Terminal Pin Rapido': [],
    'Referenciador': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Comisionista': ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle']
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
    { numero: 12, nombre: 'Identificación Oficial del Representante Legal', obligatorio: false },
    { numero: 13, nombre: 'Identificación Oficial de un tercero', obligatorio: false },
    { numero: 14, nombre: 'Carátula de Estado Cuenta para Liquidación', obligatorio: true },
    { numero: 15, nombre: 'Carta de Liquidación Otros Bancos', obligatorio: true }
  ];

  readonly documentosPorTipoComercio: Record<string, Array<Pick<DocumentoRequerido, 'numero' | 'obligatorio'>>> = {
    'Empresa Holding': [{ numero: 1, obligatorio: true }, { numero: 2, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 8, obligatorio: false }, { numero: 9, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }, { numero: 12, obligatorio: false }, { numero: 13, obligatorio: false }],
    'Empresa Grupo': [{ numero: 1, obligatorio: true }, { numero: 2, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 8, obligatorio: false }, { numero: 9, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }, { numero: 12, obligatorio: false }, { numero: 13, obligatorio: false }],
    'Sucursales de Grupo': [{ numero: 1, obligatorio: true }, { numero: 2, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 8, obligatorio: false }, { numero: 9, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }, { numero: 12, obligatorio: false }, { numero: 13, obligatorio: false }],
    'Persona Física': [{ numero: 1, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }],
    'Sucursal Persona Física': [{ numero: 1, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }],
    'Referenciador': [{ numero: 1, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }],
    'Comisionista': [{ numero: 1, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }, { numero: 10, obligatorio: false }, { numero: 11, obligatorio: false }],
    'Sucursales Únicas': [{ numero: 1, obligatorio: true }, { numero: 3, obligatorio: true }, { numero: 4, obligatorio: false }, { numero: 5, obligatorio: false }, { numero: 6, obligatorio: false }, { numero: 7, obligatorio: false }],
    'Caja con Tarjeta sólo Fondeo': [],
    'Caja con Tarjeta SPEI': [],
    'Cuenta Entidad': [],
    'Cuenta Terminal': [],
    'Cuenta Terminal Pin Rapido': []
  };

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: ['']
  });

  readonly datosForm = this.fb.nonNullable.group({
    razonSocial: [''], nombreComercial: [''], rfc: [''], regimenFiscal: [''], giroComercial: [''], descripcionGiro: [''], mcc: [''],
    mismaInfoFiscalEntidad: [false], nombre: [''], apellidoPaterno: [''], apellidoMaterno: [''], curp: [''], actividad: [''],
    tipoPersona: [''], correo: ['', Validators.email], telefono: [''], departamento: [''], ciudad: [''], direccionComercial: [''],
    codigoPostal: [''], tipoVialidad: [''], nombreVialidad: [''], numeroExterior: [''], numeroInterior: [''], colonia: [''], localidad: [''], municipio: [''], entidadFederativa: [''], entreCalle: [''], yCalle: [''],
    nombreRepresentante: [''], apellidoPaternoRepresentante: [''], apellidoMaternoRepresentante: [''], calleRepresentante: [''], numeroExteriorRepresentante: [''], numeroInteriorRepresentante: [''], codigoPostalRepresentante: [''], coloniaRepresentante: [''], municipioRepresentante: [''], estadoRepresentante: [''], correoRepresentante: [''], telefonoRepresentante: [''], telefonoAdicionalRepresentante: [''],
    mismoDomicilio: [false], codigoPostalComercial: ['', Validators.required], tipoVialidadComercial: ['', Validators.required], nombreVialidadComercial: ['', Validators.required], numeroExteriorComercial: [''], numeroInteriorComercial: [''], coloniaComercial: ['', Validators.required], localidadComercial: ['', Validators.required], municipioComercial: ['', Validators.required], entidadFederativaComercial: ['', Validators.required], entreCalleComercial: [''], yCalleComercial: [''],
    correoComercial: ['', [Validators.required, Validators.email]], telefonoComercial: ['', Validators.required], telefonoAdicionalComercial: ['']
  });

  readonly accesosForm = this.fb.nonNullable.group({
    modoReserva: ['NINGUNO' as ModoReserva, Validators.required],
    reservaSplit: [''],
    adminNombre: ['', Validators.required], adminPaterno: ['', Validators.required], adminMaterno: ['', Validators.required],
    adminCorreo: ['', [Validators.required, Validators.email]], adminConfirmarCorreo: ['', [Validators.required, Validators.email]], adminTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    facNombre: [''], facPaterno: [''], facMaterno: [''], facCorreo: ['', Validators.email], facConfirmarCorreo: ['', Validators.email], facTelefono: [''],
    tktNombre: [''], tktPaterno: [''], tktMaterno: [''], tktCorreo: ['', Validators.email], tktConfirmarCorreo: ['', Validators.email], tktTelefono: [''],
    controladorNombre: [''], controladorPaterno: [''], controladorMaterno: [''], controladorCorreo: ['', Validators.email], controladorConfirmarCorreo: ['', Validators.email], controladorTelefono: [''],
    supervisorNombre: [''], supervisorPaterno: [''], supervisorMaterno: [''], supervisorCorreo: ['', Validators.email], supervisorConfirmarCorreo: ['', Validators.email], supervisorTelefono: [''],
    perfilReservaNombre: [''], perfilReservaPaterno: [''], perfilReservaMaterno: [''], perfilReservaCorreo: [''], perfilReservaConfirmarCorreo: [''], perfilReservaTelefono: [''],
    cajasTPV: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    tieneSupervisor: ['si', Validators.required],
    pinAdministrador: [''], pinCorreo: [''], pinConfirmarCorreo: [''], pinContrasena: ['']
  }, {
    validators: [
      this.camposCoincidenValidator('adminCorreo', 'adminConfirmarCorreo', 'adminCorreosDistintos'),
      this.camposCoincidenValidator('facCorreo', 'facConfirmarCorreo', 'facCorreosDistintos'),
      this.camposCoincidenValidator('tktCorreo', 'tktConfirmarCorreo', 'tktCorreosDistintos'),
      this.camposCoincidenValidator('controladorCorreo', 'controladorConfirmarCorreo', 'controladorCorreosDistintos'),
      this.camposCoincidenValidator('supervisorCorreo', 'supervisorConfirmarCorreo', 'supervisorCorreosDistintos'),
      this.camposCoincidenValidator('perfilReservaCorreo', 'perfilReservaConfirmarCorreo', 'perfilCorreosDistintos'),
      this.camposCoincidenValidator('pinCorreo', 'pinConfirmarCorreo', 'pinCorreosDistintos')
    ]
  });

  readonly liquidacionForm = this.fb.nonNullable.group({
    cuentaFueraRed: ['otros-bancos', Validators.required],
    digitoVerificador: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    tipoPersonaBeneficiario: ['fisica' as TipoPersonaBeneficiario, Validators.required],
    beneficiarioIgualComercio: [false],
    nombreBeneficiario: ['', Validators.required], apellidoPaternoBeneficiario: ['', Validators.required], apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]], direccionBeneficiario: ['', Validators.required], rfcBeneficiario: ['', Validators.required], actividadBeneficiario: ['', Validators.required], giroBeneficiario: ['', Validators.required],
    tipoCuenta: ['', Validators.required], cuentaClabe: ['', Validators.required], nombreBanco: ['', Validators.required], direccionBanco: ['', Validators.required], telefonoBanco: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]], emailBanco: ['', [Validators.required, Validators.email]]
  });

  entidades = 2;
  referenciadores = 1;
  sucursalesBase = 3;
  cajasBase = 2;
  sucursalesPorEntidad: Record<string, number> = { 'entidad-1': 3, 'entidad-2': 3 };
  cajasPorSucursal: Record<string, number> = {};

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.comercioSeleccionado = {
      idComercio: params.get('id') ?? '',
      nivel: params.get('nivel') ?? 'Sucursal',
      nombreComercial: params.get('nombre') ?? '',
      rfc: params.get('rfc') ?? '',
      correo: params.get('correo') ?? '',
      telefono: params.get('telefono') ?? ''
    };
    this.pldID = params.get('pldID') ?? '';
    this.commerceID = params.get('commerceID') ?? '';
    this.contextoSeleccionado = {
      idComercio: this.comercioSeleccionado.idComercio,
      nivel: this.comercioSeleccionado.nivel,
      nombreComercial: this.comercioSeleccionado.nombreComercial,
      rfc: this.comercioSeleccionado.rfc
    };
    this.entidades = this.numeroParametro(params.get('entidades'), 2);
    this.sucursalesBase = this.numeroParametro(params.get('sucursales'), 3);
    this.cajasBase = this.numeroParametro(params.get('cajas'), 2);
    this.cargarEstadoRegistroLocal();
    this.inicializarEstructuraFake();

    this.nodoSeleccionado = params.get('selectedNode') ?? this.nodoInicialPorNivel(this.comercioSeleccionado.nivel);
    const nivel = this.comercioSeleccionado.nivel || 'Sucursal';
    const tipo = nivel === 'Caja' ? 'Cuenta Terminal' : nivel === 'Entidad' ? 'Empresa Grupo' : nivel === 'Sub Afiliado' ? 'Empresa Holding' : 'Sucursales de Grupo';
    this.tiposComercio = this.tiposComercioPorNivel[nivel] ?? [];
    this.comercioForm.patchValue({ nivel, tipoComercio: tipo }, { emitEvent: false });
    this.datosForm.patchValue({
      nombreComercial: this.comercioSeleccionado.nombreComercial,
      razonSocial: this.comercioSeleccionado.nombreComercial,
      rfc: this.comercioSeleccionado.rfc,
      correoComercial: this.comercioSeleccionado.correo,
      telefonoComercial: this.comercioSeleccionado.telefono
    }, { emitEvent: false });

    this.comercioForm.controls.nivel.valueChanges.subscribe(nuevoNivel => {
      this.tiposComercio = this.tiposComercioPorNivel[nuevoNivel] ?? [];
      this.comercioForm.controls.tipoComercio.setValue('', { emitEvent: false });
      if (['Referenciador', 'Comisionista'].includes(nuevoNivel)) {
        this.comercioForm.controls.tipoComercio.clearValidators();
      } else {
        this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
      }
      this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
      this.actualizarValidadoresDatos();
    });
    this.comercioForm.controls.tipoComercio.valueChanges.subscribe(() => {
      this.actualizarValidadoresDatos();
      this.actualizarValidadoresAccesosRegistro();
    });
    this.liquidacionForm.controls.tipoPersonaBeneficiario.valueChanges.subscribe(tipo => {
      this.tipoPersonaBeneficiario = tipo as TipoPersonaBeneficiario;
      this.actualizarValidadoresBeneficiario(tipo as TipoPersonaBeneficiario);
    });
    this.liquidacionForm.controls.cuentaFueraRed.valueChanges.subscribe(() => {
      this.actualizarEstadoLiquidacionRegistro();
      this.asegurarUsuarioAccesoActivo();
      this.actualizarValidadoresAccesosRegistro();
    });
    this.liquidacionForm.controls.beneficiarioIgualComercio.valueChanges.subscribe(valor => {
      this.datosBeneficiarioIgualComercio = valor;
      if (valor) {
        this.sincronizarBeneficiarioDesdeComercio();
      } else {
        this.limpiarDatosBeneficiarioLiquidacion();
      }
    });
    this.datosForm.controls.mismoDomicilio.valueChanges.subscribe(valor => {
      if (valor) this.copiarDomicilioFiscal();
    });
    this.actualizarValidadoresDatos();
    this.actualizarEstadoLiquidacionRegistro();
    this.asegurarUsuarioAccesoActivo();
    this.actualizarValidadoresAccesosRegistro();
    this.seleccionarNodoPorId(this.nodoSeleccionado);
    this.consultarResultadoSiprelad();
    this.consultarDocumentosProspecto();
  }

  get arbol(): NodoRegistro[] {
    return [{
      id: 'sub-afiliado-1',
      nombre: 'Sub Afiliado Norte',
      nivel: 'sub-afiliado',
      hijos: Array.from({ length: this.entidades }, (_, index) => this.crearEntidad(index + 1))
    }];
  }

  get camposDatosGenerales(): string[] {
    const nivel = this.comercioForm.getRawValue().nivel;
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    return this.datosGeneralesPorTipo[['Referenciador', 'Comisionista'].includes(nivel) ? nivel : tipo] ?? [];
  }

  get pasosVisiblesRegistro() {
    return this.secciones.map((seccion, index) => ({
      id: seccion.id,
      numero: index + 1,
      titulo: seccion.titulo
    }));
  }

  get seccionesVisibles(): SeccionRegistro[] {
    return this.secciones.filter(seccion => {
      if (seccion.id === 'datos') return this.camposDatosGenerales.length > 0;
      if (seccion.id === 'accesos') return this.mostrarPasoAccesos;
      if (seccion.id === 'liquidacion') return this.nivelSeleccionado !== 'caja';
      if (seccion.id === 'documentos') return this.mostrarSoloPasosTresCincoRegistroTemporal || this.documentosVisibles.length > 0;
      return true;
    });
  }

  get seccionesCardsVisibles(): SeccionRegistro[] {
    if (!this.mostrarSoloPasosTresCincoRegistroTemporal) return this.seccionesVisibles;
    return this.seccionesVisibles.filter(seccion => ['liquidacion', 'accesos', 'documentos'].includes(seccion.id));
  }

  get mostrarArbolRegistro(): boolean {
    return !this.ocultarArbolRegistroTemporal;
  }

  numeroPasoRegistro(id: SeccionRegistro['id']): number {
    return this.secciones.findIndex(seccion => seccion.id === id) + 1;
  }

  get documentosVisibles(): DocumentoRequerido[] {
    if (this.esNodoExistente && this.documentosProspecto.length) {
      return this.documentosProspecto.map((documentoProspecto, index) => this.documentoRequeridoDesdeProspecto(documentoProspecto, index));
    }

    const nivel = this.comercioForm.getRawValue().nivel;
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const tipoEfectivo = ['Referenciador', 'Comisionista'].includes(nivel) ? nivel : tipo;
    const reglas = this.documentosPorTipoComercio[tipoEfectivo] ?? [];
    return reglas.map(regla => {
      const documento = this.documentos.find(item => item.numero === regla.numero);
      if (!documento) return undefined;
      const documentoVisible = { ...documento, obligatorio: regla.obligatorio };
      if (this.esNodoExistente) {
        const documentoProspecto = this.documentoProspectoPara(documentoVisible);
        documentoVisible.archivoNombre = this.nombreDocumentoCargado(documentoVisible, documentoProspecto);
        documentoVisible.archivoUrl = this.urlDocumentoCargado(documentoProspecto);
        documentoVisible.archivoId = this.idDocumentoCargado(documentoProspecto);
        documentoVisible.s3Key = this.s3KeyDocumentoCargado(documentoProspecto);
        documentoVisible.tipoArchivo = this.tipoDocumentoCargado(documentoProspecto);
        documentoVisible.estado = this.estadoDocumentoCargado(documentoProspecto);
        documentoVisible.estatusRevision = this.estatusRevisionDocumento(documentoProspecto);
      }
      return this.esNodoExistente ? documentoVisible : Object.assign(documento, { obligatorio: regla.obligatorio });
    }).filter((documento): documento is DocumentoRequerido => !!documento);
  }

  get documentosCargados(): number { return this.documentosVisibles.filter(documento => !!(documento.archivo || documento.archivoNombre)).length; }
  get documentosPendientes(): number { return this.documentosVisibles.filter(documento => documento.obligatorio && !(documento.archivo || documento.archivoNombre)).length; }
  get esNodoExistente(): boolean { return !this.nodosNuevos.has(this.nodoSeleccionado); }
  get mostrarPasoAccesos(): boolean { return this.nivelSeleccionado !== 'caja'; }
  get esSucursalAgrupadora(): boolean {
    return this.comercioForm.getRawValue().nivel === 'Sucursal'
      && this.comercioForm.getRawValue().tipoComercio === 'Sucursales de Grupo';
  }
  get usuariosAcceso(): UsuarioAccesoConfig[] {
    if (this.esSucursalAgrupadora) {
      return [this.usuariosAccesoBase.controlador, this.usuariosAccesoBase.supervisor];
    }

    const cuentaLiquidacion = this.liquidacionForm.controls.cuentaFueraRed.value;
    if (cuentaLiquidacion === 'otros-bancos-en-red') {
      return [this.usuariosAccesoBase.fac, this.usuariosAccesoBase.tkt];
    }

    if (cuentaLiquidacion === 'otros-bancos' || cuentaLiquidacion === 'en-red' || cuentaLiquidacion === 'si') {
      return [this.usuariosAccesoBase.admin];
    }

    return [];
  }
  get nivelesNodoActual(): string[] {
    const nivel = this.comercioForm.getRawValue().nivel;
    return nivel ? [nivel] : this.niveles;
  }
  get mostrarInfoFiscalEntidadSucursal(): boolean { return this.nivelSeleccionado === 'sucursal'; }
  get nivelSeleccionado(): NivelNodo { return this.buscarNodo(this.arbol, this.nodoSeleccionado)?.nivel ?? 'sucursal'; }

  private consultarResultadoSiprelad(): void {
    if (!this.pldID) {
      this.resultadoSiprelad = 'No se encontraron registros relacionados con PLD';
      this.resultadosSiprelad = [];
      return;
    }

    this.cargandoSiprelad = true;
    this.resultadoSiprelad = 'Consultando resultado en listas SIPRELAD...';
    this.sipreladService.consultarResultadoPld(this.pldID).subscribe({
      next: resultados => {
        this.resultadosSiprelad = resultados;
        this.resultadoSiprelad = resultados.length
          ? ''
          : 'No se encontraron registros relacionados con PLD';
        this.cargandoSiprelad = false;
      },
      error: () => {
        this.resultadosSiprelad = [];
        this.resultadoSiprelad = 'No fue posible consultar el resultado de SIPRELAD.';
        this.cargandoSiprelad = false;
      }
    });
  }

  private consultarDocumentosProspecto(): void {
    if (!this.commerceID) {
      this.documentosProspecto = [];
      return;
    }

    this.cargandoDocumentosProspecto = true;
    this.errorDocumentosProspecto = '';
    this.documentosProspectoService.consultarDocumentos(this.commerceID).subscribe({
      next: respuesta => {
        if (respuesta.success === false) {
          this.documentosProspecto = [];
          this.errorDocumentosProspecto = respuesta.error?.message || 'No fue posible consultar los documentos del comercio.';
          this.cargandoDocumentosProspecto = false;
          return;
        }

        this.documentosProspecto = this.documentosDesdeRespuesta(respuesta);
        this.observacionesInternasMesaDigital = respuesta.internalObservations ?? '';
        this.cargandoDocumentosProspecto = false;
      },
      error: () => {
        this.documentosProspecto = [];
        this.errorDocumentosProspecto = 'No fue posible consultar los documentos del comercio.';
        this.cargandoDocumentosProspecto = false;
      }
    });
  }

  cambiarEntidades(cambio: number): void {
    this.guardarCapturaNodoActual();
    const totalAnterior = this.entidades;
    this.entidades = Math.max(1, this.entidades + cambio);
    if (cambio > 0 && this.entidades > totalAnterior) {
      const entidadId = `entidad-${this.entidades}`;
      const sucursalId = `${entidadId}-sucursal-1`;
      this.sucursalesPorEntidad[entidadId] = 1;
      this.cajasPorSucursal[sucursalId] = 1;
      this.nodosNuevos.add(entidadId);
      this.nodosNuevos.add(sucursalId);
      this.nodosNuevos.add(`${sucursalId}-caja-1`);
      this.abrirPadres(entidadId);
      this.seleccionarNodoPorId(entidadId);
      return;
    }
    this.seleccionarNodoPorId(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.id ?? 'entidad-1');
  }

  cambiarReferenciadores(cambio: number): void {
    this.guardarCapturaNodoActual();
    const totalAnterior = this.referenciadores;
    this.referenciadores = Math.max(0, this.referenciadores + cambio);
    if (cambio > 0 && this.referenciadores > totalAnterior) {
      const referenciadorId = `referenciador-${this.referenciadores}`;
      this.nodosNuevos.add(referenciadorId);
      this.abrirPadres(referenciadorId);
      this.seleccionarNodoPorId(referenciadorId);
      return;
    }
    this.seleccionarNodoPorId(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.id ?? 'sub-afiliado-1');
  }

  cambiarSucursales(entidadId: string, cambio: number): void {
    this.guardarCapturaNodoActual();
    const totalAnterior = this.sucursalesPorEntidad[entidadId] ?? 1;
    this.sucursalesPorEntidad[entidadId] = Math.max(1, totalAnterior + cambio);
    if (cambio > 0 && this.sucursalesPorEntidad[entidadId] > totalAnterior) {
      const sucursalId = `${entidadId}-sucursal-${this.sucursalesPorEntidad[entidadId]}`;
      this.cajasPorSucursal[sucursalId] = 1;
      this.nodosNuevos.add(sucursalId);
      this.nodosNuevos.add(`${sucursalId}-caja-1`);
      this.abrirPadres(sucursalId);
      this.seleccionarNodoPorId(sucursalId);
      return;
    }
    this.seleccionarNodoPorId(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.id ?? entidadId);
  }

  cambiarCajas(sucursalId: string, cambio: number): void {
    this.guardarCapturaNodoActual();
    const totalAnterior = this.cajasPorSucursal[sucursalId] ?? 1;
    this.cajasPorSucursal[sucursalId] = Math.max(1, totalAnterior + cambio);
    if (cambio > 0 && this.cajasPorSucursal[sucursalId] > totalAnterior) {
      const cajaId = `${sucursalId}-caja-${this.cajasPorSucursal[sucursalId]}`;
      this.nodosNuevos.add(cajaId);
      this.abrirPadres(cajaId);
      this.seleccionarNodoPorId(cajaId);
      return;
    }
    this.seleccionarNodoPorId(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.id ?? sucursalId);
  }

  seleccionarNodo(nodo: NodoRegistro): void {
    this.guardarCapturaNodoActual();
    this.nodoSeleccionado = nodo.id;
    const nivel = nodo.nivel === 'sub-afiliado' ? 'Sub Afiliado' : nodo.nivel === 'referenciador' ? 'Referenciador' : nodo.nivel === 'entidad' ? 'Entidad' : nodo.nivel === 'sucursal' ? 'Sucursal' : 'Caja';
    const tipo = nivel === 'Caja' ? 'Cuenta Terminal' : nivel === 'Entidad' ? 'Empresa Grupo' : nivel === 'Sub Afiliado' ? 'Empresa Holding' : nivel === 'Referenciador' ? '' : 'Sucursales de Grupo';
    this.tiposComercio = this.tiposComercioPorNivel[nivel] ?? [];
    if (['Referenciador', 'Comisionista'].includes(nivel)) {
      this.comercioForm.controls.tipoComercio.clearValidators();
    } else {
      this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
    }
    this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
    this.comercioForm.patchValue({ nivel, tipoComercio: tipo }, { emitEvent: false });
    const registro = this.registroFakePorNodo(nodo.id);
    this.contextoSeleccionado = {
      idComercio: this.idFakeNodo(nodo.id),
      nivel,
      nombreComercial: registro.nombreComercial || nodo.nombre,
      rfc: registro.rfc || this.rfcFake(nodo.id)
    };
    this.cargarCapturaNodo(nodo.id);
    this.asegurarUsuarioAccesoActivo();
    this.actualizarValidadoresAccesosRegistro();
    this.seccionAbierta = this.resolverSeccionVisible(this.seccionAbierta ?? 'comercio');
    this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta ?? 'comercio');
  }

  alternarNodo(id: string): void {
    this.nodosColapsados.has(id) ? this.nodosColapsados.delete(id) : this.nodosColapsados.add(id);
  }

  nodoExpandido(id: string): boolean { return !this.nodosColapsados.has(id); }
  esNodoSeleccionado(nodo: NodoRegistro): boolean { return this.nodoSeleccionado === nodo.id; }
  iconoNodo(nivel: NivelNodo): string {
    if (nivel === 'caja') return 'fa-cash-register';
    if (nivel === 'referenciador') return 'fa-user-tag';
    return 'fa-folder';
  }
  alternarSeccion(id: SeccionRegistro['id']): void {
    this.seccionAbierta = this.seccionAbierta === id ? null : id;
    if (this.seccionAbierta) this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta);
  }
  continuarSeccion(siguiente: SeccionRegistro['id']): void {
    this.seccionAbierta = this.resolverSeccionVisible(siguiente);
    this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta ?? 'comercio');
  }
  volver(): void { this.router.navigate(['/consulta_comercios']); }
  finalizar(): void {
    if (this.esNodoExistente && this.documentosProspecto.length) {
      this.guardarRevisionDocumentos();
      return;
    }

    this.guardarCapturaNodoActual();
    const nodoGuardado = this.nodoSeleccionado;
    this.guardarLiquidacionActual();
    this.consolidarNodoActual();
    if (this.seleccionarPrimerHijoNuevo(nodoGuardado)) return;
    this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta ?? 'comercio');
  }

  pasoCompletado(id: SeccionRegistro['id']): boolean {
    return this.pasosCompletados.has(this.clavePasoNodo(id))
      || (this.mostrarSoloPasosTresCincoRegistroTemporal && ['comercio', 'datos'].includes(id));
  }

  completarPaso(id: SeccionRegistro['id'], siguiente?: SeccionRegistro['id']): void {
    this.guardarCapturaNodoActual();
    this.pasosCompletados.add(this.clavePasoNodo(id));
    if (siguiente) {
      this.seccionAbierta = this.resolverSeccionVisible(siguiente, id);
      this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta);
    }
  }

  guardarLiquidacion(): void {
    this.guardarCapturaNodoActual();
    this.guardarLiquidacionActual();
    this.pasosCompletados.add(this.clavePasoNodo('liquidacion'));
    this.guardarComercioLocal();
    this.guardarEstadoRegistroLocal();
    this.liquidacionPorNodo = { ...this.liquidacionPorNodo };
    if (this.mostrarPasoAccesos) {
      this.seccionAbierta = this.resolverSeccionVisible('accesos', 'liquidacion');
      this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta);
    }
  }

  estadoPaso(id: SeccionRegistro['id']): string {
    if (this.mostrarSoloPasosTresCincoRegistroTemporal && ['comercio', 'datos'].includes(id)) return 'Completado';
    if (this.esNodoExistente && id !== 'liquidacion' && id !== 'accesos' && id !== 'documentos') return 'Completado';
    if (id === 'liquidacion' && this.tieneLiquidacion(this.nodoSeleccionado)) return 'Completado';
    if (id === 'accesos' && this.pasoCompletado(id) && this.accesosTieneContenido(this.accesosForm.getRawValue())) return 'Completado';
    if (this.seccionAbierta === id) return 'En curso';
    if (id === 'accesos') return 'Pendiente';
    if (this.pasoCompletado(id)) return 'Completado';
    return 'Pendiente';
  }

  rutaSeleccionada(): string {
    return this.buscarRuta(this.arbol, this.nodoSeleccionado).join(' > ');
  }

  seleccionarArchivo(event: Event, documento: DocumentoRequerido): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    documento.archivo = archivo;
    documento.archivoNombre = archivo.name;
  }

  actualizarEstatusDocumento(documento: DocumentoRequerido, estado: EstatusDocumentoProspecto): void {
    documento.estatusRevision = estado;
    documento.estado = this.traducirEstatusDocumento(estado);

    const documentoProspecto = this.documentosProspecto.find(item => this.idDocumentoCargado(item) === documento.archivoId);
    if (documentoProspecto) {
      documentoProspecto.status = estado;
    }
  }

  verDocumentoProspecto(documento: DocumentoRequerido): void {
    if (documento.archivoUrl) {
      window.open(documento.archivoUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    this.errorDocumentosProspecto = 'El servicio no regreso una URL para abrir este documento.';
  }

  private guardarRevisionDocumentos(): void {
    const legalDocuments = this.documentosProspecto
      .map(documento => ({
        id: this.idDocumentoCargado(documento),
        status: this.estatusDocumentoParaEnvio(documento),
      }))
      .filter(documento => !!documento.id);

    if (!this.commerceID || !legalDocuments.length) return;

    this.guardandoRevisionDocumentos = true;
    this.errorDocumentosProspecto = '';
    this.documentosProspectoService.actualizarRevision({
      commerceId: this.commerceID,
      generalStatus: this.estatusGeneralParaEnvio(legalDocuments.map(documento => documento.status)),
      internalObservations: this.observacionesInternasMesaDigital.trim() || null,
      reviewedBy: this.usuarioRevision(),
      legalDocuments,
    }).subscribe({
      next: () => {
        this.guardandoRevisionDocumentos = false;
        this.guardarCapturaNodoActual();
        const nodoGuardado = this.nodoSeleccionado;
        this.guardarLiquidacionActual();
        this.consolidarNodoActual();
        if (this.seleccionarPrimerHijoNuevo(nodoGuardado)) return;
        this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta ?? 'comercio');
      },
      error: () => {
        this.guardandoRevisionDocumentos = false;
        this.errorDocumentosProspecto = 'No fue posible guardar la revisión de documentos.';
      }
    });
  }

  alternarInfoFiscalEntidad(usarInfoEntidad: boolean): void {
    this.datosForm.controls.mismaInfoFiscalEntidad.setValue(usarInfoEntidad, { emitEvent: false });
    if (usarInfoEntidad) {
      this.copiarInfoFiscalEntidad();
      if (this.datosForm.controls.mismoDomicilio.value) {
        this.copiarDomicilioFiscal();
      }
    }
  }

  seleccionarUsuarioAcceso(prefijo: string): void {
    this.usuarioAccesoActivo = prefijo as PrefijoAccesoRegistro;
    this.actualizarValidadoresAccesosRegistro();
  }

  private nodoInicialPorNivel(nivel: string): string {
    if (nivel === 'Sub Afiliado') return 'sub-afiliado-1';
    if (nivel === 'Entidad') return 'entidad-1';
    if (nivel === 'Sucursal') return 'entidad-1-sucursal-1';
    return 'entidad-1-sucursal-1-caja-1';
  }

  private numeroParametro(valor: string | null, respaldo: number): number {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : respaldo;
  }

  private inicializarEstructuraFake(): void {
    for (let entidad = 1; entidad <= this.entidades; entidad += 1) {
      const entidadId = `entidad-${entidad}`;
      this.sucursalesPorEntidad[entidadId] ??= this.sucursalesBase;
      for (let sucursal = 1; sucursal <= this.sucursalesPorEntidad[entidadId]; sucursal += 1) {
        this.cajasPorSucursal[`${entidadId}-sucursal-${sucursal}`] ??= this.cajasBase;
      }
    }
  }

  private clavePasoNodo(id: SeccionRegistro['id']): string {
    return `${this.nodoSeleccionado}:${id}`;
  }

  private numeroPasoPorSeccion(id: SeccionRegistro['id']): number {
    const index = this.secciones.findIndex(seccion => seccion.id === id);
    return index >= 0 ? index + 1 : 1;
  }

  private resolverSeccionVisible(preferida: SeccionRegistro['id'], actual?: SeccionRegistro['id']): SeccionRegistro['id'] {
    if (this.seccionesVisibles.some(seccion => seccion.id === preferida)) return preferida;

    const inicio = actual
      ? this.secciones.findIndex(seccion => seccion.id === actual) + 1
      : this.secciones.findIndex(seccion => seccion.id === preferida) + 1;
    const siguienteVisible = this.secciones
      .slice(Math.max(inicio, 0))
      .find(seccion => this.seccionesVisibles.some(visible => visible.id === seccion.id));

    return siguienteVisible?.id ?? this.seccionesVisibles[this.seccionesVisibles.length - 1]?.id ?? 'comercio';
  }

  private guardarCapturaNodoActual(): void {
    this.comercioPorNodo[this.nodoSeleccionado] = this.comercioForm.getRawValue();
    this.datosPorNodo[this.nodoSeleccionado] = this.datosForm.getRawValue();
    const accesos = this.accesosForm.getRawValue();
    if (this.accesosTieneContenido(accesos)) {
      this.accesosPorNodo[this.nodoSeleccionado] = accesos;
    } else {
      delete this.accesosPorNodo[this.nodoSeleccionado];
    }
  }

  private guardarLiquidacionActual(): void {
    const liquidacion = this.liquidacionForm.getRawValue();
    if (this.liquidacionTieneContenido(liquidacion)) {
      this.liquidacionPorNodo[this.nodoSeleccionado] = liquidacion;
    } else {
      delete this.liquidacionPorNodo[this.nodoSeleccionado];
    }
  }

  private consolidarNodoActual(): void {
    this.nodosNuevos.delete(this.nodoSeleccionado);
    this.guardarComercioLocal();
    this.guardarEstadoRegistroLocal();
    this.seccionesVisibles.forEach(seccion => {
      if (
        seccion.id === 'liquidacion'
          ? this.tieneLiquidacion(this.nodoSeleccionado)
          : seccion.id === 'accesos'
            ? this.accesosTieneContenido(this.accesosForm.getRawValue())
            : true
      ) {
        this.pasosCompletados.add(this.clavePasoNodo(seccion.id));
      }
    });
    this.actualizarModoEdicionNodo(this.nodoSeleccionado);
  }

  private seleccionarPrimerHijoNuevo(nodoId: string): boolean {
    const nodo = this.buscarNodo(this.arbol, nodoId);
    const siguiente = (nodo?.hijos ?? []).find(hijo => this.nodosNuevos.has(hijo.id));
    if (!siguiente) return false;

    this.abrirPadres(siguiente.id);
    this.seleccionarNodoPorId(siguiente.id);
    this.seccionAbierta = 'comercio';
    this.pasoActual = this.numeroPasoPorSeccion(this.seccionAbierta);
    return true;
  }

  private guardarComercioLocal(): void {
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    const comercio = this.comercioForm.getRawValue();
    const datos = this.datosForm.getRawValue();
    const nivel = comercio.nivel as 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja';
    const item = {
      idComercio: this.idFakeNodo(this.nodoSeleccionado),
      nodoId: this.nodoSeleccionado,
      nivel,
      jerarquia: this.rutaSeleccionada(),
      nombreComercial: datos.nombreComercial || nodo?.nombre || 'Nuevo comercio',
      razonSocial: datos.razonSocial || datos.nombreComercial || nodo?.nombre || 'Nuevo comercio',
      rfc: datos.rfc || this.rfcFake(this.nodoSeleccionado),
      correo: datos.correoComercial || datos.correo || '',
      telefono: datos.telefonoComercial || datos.telefono || '',
      estatus: 'Activo',
      tieneInferiores: (nodo?.hijos?.length ?? 0) > 0,
      cuentaLiquidacion: this.tieneLiquidacion(this.nodoSeleccionado)
    };

    try {
      const actuales = JSON.parse(localStorage.getItem(this.comerciosLocalesKey) || '[]') as Array<typeof item>;
      const sinDuplicado = actuales.filter(actual => actual.idComercio !== item.idComercio);
      localStorage.setItem(this.comerciosLocalesKey, JSON.stringify([...sinDuplicado, item]));
    } catch {
      localStorage.setItem(this.comerciosLocalesKey, JSON.stringify([item]));
    }
  }

  private guardarEstadoRegistroLocal(): void {
    const estado = {
      entidades: this.entidades,
      referenciadores: this.referenciadores,
      sucursalesBase: this.sucursalesBase,
      cajasBase: this.cajasBase,
      sucursalesPorEntidad: this.sucursalesPorEntidad,
      cajasPorSucursal: this.cajasPorSucursal,
      comercioPorNodo: this.comercioPorNodo,
      datosPorNodo: this.datosPorNodo,
      accesosPorNodo: this.accesosPorNodo,
      liquidacionPorNodo: this.liquidacionPorNodo
    };

    localStorage.setItem(this.registroLocalKey, JSON.stringify(estado));
  }

  private cargarEstadoRegistroLocal(): void {
    try {
      const estado = JSON.parse(localStorage.getItem(this.registroLocalKey) || 'null') as Partial<{
        entidades: number;
        referenciadores: number;
        sucursalesBase: number;
        cajasBase: number;
        sucursalesPorEntidad: Record<string, number>;
        cajasPorSucursal: Record<string, number>;
        comercioPorNodo: Record<string, ReturnType<RegistroClienteComponent['comercioForm']['getRawValue']>>;
        datosPorNodo: Record<string, ReturnType<RegistroClienteComponent['datosForm']['getRawValue']>>;
        accesosPorNodo: Record<string, ReturnType<RegistroClienteComponent['accesosForm']['getRawValue']>>;
        liquidacionPorNodo: Record<string, ReturnType<RegistroClienteComponent['liquidacionForm']['getRawValue']>>;
      }> | null;
      if (!estado) return;

      this.entidades = Math.max(this.entidades, Number(estado.entidades) || this.entidades);
      this.referenciadores = Math.max(this.referenciadores, Number(estado.referenciadores) || this.referenciadores);
      this.sucursalesBase = Math.max(this.sucursalesBase, Number(estado.sucursalesBase) || this.sucursalesBase);
      this.cajasBase = Math.max(this.cajasBase, Number(estado.cajasBase) || this.cajasBase);
      this.sucursalesPorEntidad = { ...this.sucursalesPorEntidad, ...(estado.sucursalesPorEntidad ?? {}) };
      this.cajasPorSucursal = { ...this.cajasPorSucursal, ...(estado.cajasPorSucursal ?? {}) };
      this.comercioPorNodo = { ...this.comercioPorNodo, ...(estado.comercioPorNodo ?? {}) };
      this.datosPorNodo = { ...this.datosPorNodo, ...(estado.datosPorNodo ?? {}) };
      const accesosGuardados = Object.fromEntries(
        Object.entries(estado.accesosPorNodo ?? {}).filter(([, accesos]) => this.accesosTieneContenido(accesos))
      ) as Record<string, ReturnType<RegistroClienteComponent['accesosForm']['getRawValue']>>;
      this.accesosPorNodo = { ...this.accesosPorNodo, ...accesosGuardados };
      this.liquidacionPorNodo = { ...this.liquidacionPorNodo, ...(estado.liquidacionPorNodo ?? {}) };
    } catch {
      return;
    }
  }

  private cargarCapturaNodo(nodoId: string): void {
    const comercio = this.comercioPorNodo[nodoId];
    const datos = this.datosPorNodo[nodoId];
    const accesos = this.accesosPorNodo[nodoId];
    const liquidacion = this.liquidacionPorNodo[nodoId];
    if (comercio) this.comercioForm.patchValue(comercio, { emitEvent: false });
    if (!this.nodosNuevos.has(nodoId)) {
      this.datosForm.reset();
      this.datosForm.patchValue({ ...this.datosFakeNodo(nodoId), ...this.valoresConContenido(datos) }, { emitEvent: false });
    } else if (datos) {
      this.datosForm.patchValue(datos, { emitEvent: false });
    } else {
      this.datosForm.reset();
    }
    if (accesos) {
      this.accesosForm.patchValue(accesos, { emitEvent: false });
    } else {
      this.accesosForm.reset();
    }
    this.liquidacionForm.reset({
      cuentaFueraRed: 'otros-bancos',
      digitoVerificador: '',
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
      emailBanco: ''
    }, { emitEvent: false });
    if (liquidacion) this.liquidacionForm.patchValue(liquidacion, { emitEvent: false });
    this.actualizarModoEdicionNodo(nodoId);
    this.actualizarValidadoresDatos();
  }

  private crearEntidad(numero: number): NodoRegistro {
    const entidadId = `entidad-${numero}`;
    const sucursales = this.sucursalesPorEntidad[entidadId] ?? 1;
    return {
      id: entidadId,
      nombre: this.nombreNodoGuardado(entidadId) || (numero === 1 ? 'Entidad Financiera México' : numero === 2 ? 'Entidad Financiera Occidente' : `Entidad ${String(numero).padStart(2, '0')}`),
      nivel: 'entidad',
      hijos: Array.from({ length: sucursales }, (_, index) => this.crearSucursal(entidadId, index + 1))
    };
  }

  private crearReferenciador(numero: number): NodoRegistro {
    return {
      id: `referenciador-${numero}`,
      nombre: `Referenciador ${String(numero).padStart(2, '0')}`,
      nivel: 'referenciador'
    };
  }

  private crearSucursal(entidadId: string, numero: number): NodoRegistro {
    const sucursalId = `${entidadId}-sucursal-${numero}`;
    this.cajasPorSucursal[sucursalId] ??= this.cajasBase;
    return {
      id: sucursalId,
      nombre: this.nombreNodoGuardado(sucursalId) || this.nombreSucursalFake(entidadId, numero),
      nivel: 'sucursal',
      hijos: Array.from({ length: this.cajasPorSucursal[sucursalId] ?? 1 }, (_, index) => ({
        id: `${sucursalId}-caja-${index + 1}`,
        nombre: this.nombreNodoGuardado(`${sucursalId}-caja-${index + 1}`) || `Caja ${String(index + 1).padStart(2, '0')}`,
        nivel: 'caja' as NivelNodo
      }))
    };
  }

  private nombreNodoGuardado(nodoId: string): string {
    const datos = this.datosPorNodo[nodoId];
    const comercio = this.comercioPorNodo[nodoId];
    return `${datos?.nombreComercial || datos?.razonSocial || comercio?.tipoComercio || ''}`.trim();
  }

  private seleccionarNodoPorId(id: string): void {
    const nodo = this.buscarNodo(this.arbol, id);
    if (nodo) this.seleccionarNodo(nodo);
  }

  private abrirPadres(id: string): void {
    const partes = id.split('-');
    this.nodosColapsados.delete('sub-afiliado-1');
    if (partes[0] === 'entidad') {
      this.nodosColapsados.delete(`entidad-${partes[1]}`);
    }
    if (partes.includes('sucursal')) {
      this.nodosColapsados.delete(`entidad-${partes[1]}-sucursal-${partes[3]}`);
    }
  }

  private actualizarModoEdicionNodo(nodoId: string): void {
    const puedeEditarTodo = this.nodosNuevos.has(nodoId);
    const opciones = { emitEvent: false };

    if (puedeEditarTodo) {
      this.comercioForm.enable(opciones);
      this.datosForm.enable(opciones);
      this.accesosForm.enable(opciones);
      this.comercioForm.controls.nivel.disable(opciones);
    } else {
      this.comercioForm.disable(opciones);
      this.datosForm.disable(opciones);
      this.accesosForm.enable(opciones);
    }

    this.liquidacionForm.enable(opciones);
  }

  tieneLiquidacion(nodoId: string): boolean {
    return this.liquidacionTieneContenido(this.liquidacionPorNodo[nodoId]);
  }

  private liquidacionTieneContenido(liquidacion: ReturnType<typeof this.liquidacionForm.getRawValue> | undefined): boolean {
    if (!liquidacion) return false;

    return [
      liquidacion.digitoVerificador,
      liquidacion.nombreBeneficiario,
      liquidacion.apellidoPaternoBeneficiario,
      liquidacion.apellidoMaternoBeneficiario,
      liquidacion.correoBeneficiario,
      liquidacion.direccionBeneficiario,
      liquidacion.rfcBeneficiario,
      liquidacion.actividadBeneficiario,
      liquidacion.giroBeneficiario,
      liquidacion.tipoCuenta,
      liquidacion.cuentaClabe,
      liquidacion.nombreBanco,
      liquidacion.direccionBanco,
      liquidacion.telefonoBanco,
      liquidacion.emailBanco
    ].some(valor => `${valor ?? ''}`.trim() !== '');
  }

  private datosFakeNodo(nodoId: string): Partial<ReturnType<typeof this.datosForm.getRawValue>> {
    const nodo = this.buscarNodo(this.arbol, nodoId);
    const registro = this.registroFakePorNodo(nodoId);
    const nombre = registro.nombreComercial || nodo?.nombre || this.comercioSeleccionado.nombreComercial;
    const slug = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');
    return {
      nombreComercial: nombre,
      razonSocial: registro.razonSocial || `${nombre} SA de CV`,
      rfc: registro.rfc || this.rfcFake(nodoId),
      regimenFiscal: '601 - General de Ley Personas Morales',
      giroComercial: 'Servicios financieros',
      descripcionGiro: 'Servicios de pago y comercio',
      mcc: '6012',
      tipoPersona: 'Jurídica',
      correo: registro.correo || `${slug || 'comercio'}@subnorte.com`,
      telefono: registro.telefono || '5510000000',
      departamento: 'Bogotá D.C.',
      ciudad: 'Bogotá',
      direccionComercial: 'Avenida Principal 100, Centro',
      codigoPostal: '50000',
      tipoVialidad: 'Avenida',
      nombreVialidad: 'Principal',
      numeroExterior: '100',
      numeroInterior: '1',
      colonia: 'Centro',
      localidad: 'Toluca',
      municipio: 'Toluca',
      entidadFederativa: 'Estado de México',
      entreCalle: 'Independencia',
      yCalle: 'Reforma',
      nombreRepresentante: 'Representante',
      apellidoPaternoRepresentante: 'Legal',
      apellidoMaternoRepresentante: 'Kashpay',
      calleRepresentante: 'Avenida Principal',
      numeroExteriorRepresentante: '100',
      numeroInteriorRepresentante: '1',
      codigoPostalRepresentante: '50000',
      coloniaRepresentante: 'Centro',
      municipioRepresentante: 'Toluca',
      estadoRepresentante: 'Estado de México',
      correoRepresentante: `representante.${slug || 'comercio'}@subnorte.com`,
      telefonoRepresentante: '5512345678',
      telefonoAdicionalRepresentante: '5598765432',
      correoComercial: registro.correo || `${slug || 'comercio'}@subnorte.com`,
      telefonoComercial: registro.telefono || '5510000000',
      codigoPostalComercial: '50000',
      tipoVialidadComercial: 'Avenida',
      nombreVialidadComercial: 'Principal',
      numeroExteriorComercial: '100',
      numeroInteriorComercial: '1',
      coloniaComercial: 'Centro',
      localidadComercial: 'Toluca',
      municipioComercial: 'Toluca',
      entidadFederativaComercial: 'Estado de México',
      entreCalleComercial: 'Independencia',
      yCalleComercial: 'Reforma'
    };
  }

  private copiarDomicilioFiscal(): void {
    const datos = this.datosForm.getRawValue();

    this.datosForm.patchValue({
      codigoPostalComercial: datos.codigoPostal,
      tipoVialidadComercial: datos.tipoVialidad,
      nombreVialidadComercial: datos.nombreVialidad,
      numeroExteriorComercial: datos.numeroExterior,
      numeroInteriorComercial: datos.numeroInterior,
      coloniaComercial: datos.colonia,
      localidadComercial: datos.localidad,
      municipioComercial: datos.municipio,
      entidadFederativaComercial: datos.entidadFederativa,
      entreCalleComercial: datos.entreCalle,
      yCalleComercial: datos.yCalle
    }, { emitEvent: false });
  }

  private copiarInfoFiscalEntidad(): void {
    const entidadId = this.entidadPadreId(this.nodoSeleccionado);
    if (!entidadId) return;

    const datosEntidad = {
      ...this.datosFakeNodo(entidadId),
      ...this.valoresConContenido(this.datosPorNodo[entidadId])
    };

    this.datosForm.patchValue({
      rfc: datosEntidad.rfc,
      razonSocial: datosEntidad.razonSocial,
      nombreComercial: datosEntidad.nombreComercial,
      regimenFiscal: datosEntidad.regimenFiscal,
      giroComercial: datosEntidad.giroComercial,
      descripcionGiro: datosEntidad.descripcionGiro,
      mcc: datosEntidad.mcc,
      tipoPersona: datosEntidad.tipoPersona,
      correo: datosEntidad.correo,
      telefono: datosEntidad.telefono,
      departamento: datosEntidad.departamento,
      ciudad: datosEntidad.ciudad,
      direccionComercial: datosEntidad.direccionComercial,
      codigoPostal: datosEntidad.codigoPostal,
      tipoVialidad: datosEntidad.tipoVialidad,
      nombreVialidad: datosEntidad.nombreVialidad,
      numeroExterior: datosEntidad.numeroExterior,
      numeroInterior: datosEntidad.numeroInterior,
      colonia: datosEntidad.colonia,
      localidad: datosEntidad.localidad,
      municipio: datosEntidad.municipio,
      entidadFederativa: datosEntidad.entidadFederativa,
      entreCalle: datosEntidad.entreCalle,
      yCalle: datosEntidad.yCalle
    }, { emitEvent: false });
  }

  private entidadPadreId(nodoId: string): string {
    const match = nodoId.match(/^(entidad-\d+)/);
    return match?.[1] ?? '';
  }

  private valoresConContenido<T extends Record<string, unknown>>(valores: T | undefined): Partial<T> {
    if (!valores) return {};

    return Object.fromEntries(
      Object.entries(valores).filter(([, valor]) => {
        if (typeof valor === 'string') return valor.trim() !== '';
        return valor !== null && valor !== undefined;
      })
    ) as Partial<T>;
  }

  private accesosTieneContenido(accesos: ReturnType<typeof this.accesosForm.getRawValue>): boolean {
    return Object.entries(accesos).some(([campo, valor]) => {
      if (campo === 'modoReserva') return typeof valor === 'string' && valor.trim() !== '' && valor !== 'NINGUNO';
      if (campo === 'tieneSupervisor') return typeof valor === 'string' && valor.trim() !== '' && valor !== 'si';
      if (campo === 'cajasTPV') return typeof valor === 'string' && valor.trim() !== '' && valor !== '1';
      if (typeof valor === 'string') return valor.trim() !== '';
      return Boolean(valor);
    });
  }

  private accesosFakeNodo(nodoId: string): Partial<ReturnType<typeof this.accesosForm.getRawValue>> {
    const registro = this.registroFakePorNodo(nodoId);
    const nombre = registro.nombreComercial || this.buscarNodo(this.arbol, nodoId)?.nombre || 'Comercio';
    const slug = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');

    return {
      modoReserva: 'NINGUNO',
      reservaSplit: '',
      adminNombre: 'Administrador',
      adminPaterno: 'Principal',
      adminMaterno: 'Kashpay',
      adminCorreo: `admin.${slug || 'comercio'}@subnorte.com`,
      adminConfirmarCorreo: `admin.${slug || 'comercio'}@subnorte.com`,
      adminTelefono: '5512345678',
      facNombre: 'Administrador',
      facPaterno: 'FAC',
      facMaterno: 'Kashpay',
      facCorreo: `fac.${slug || 'comercio'}@subnorte.com`,
      facConfirmarCorreo: `fac.${slug || 'comercio'}@subnorte.com`,
      facTelefono: '5512345678',
      tktNombre: 'Administrador',
      tktPaterno: 'TKT',
      tktMaterno: 'Kashpay',
      tktCorreo: `tkt.${slug || 'comercio'}@subnorte.com`,
      tktConfirmarCorreo: `tkt.${slug || 'comercio'}@subnorte.com`,
      tktTelefono: '5512345678',
      controladorNombre: 'Controlador',
      controladorPaterno: 'Recursos',
      controladorMaterno: 'Kashpay',
      controladorCorreo: `controlador.${slug || 'comercio'}@subnorte.com`,
      controladorConfirmarCorreo: `controlador.${slug || 'comercio'}@subnorte.com`,
      controladorTelefono: '5512345678',
      supervisorNombre: 'Supervisor',
      supervisorPaterno: 'Terminales',
      supervisorMaterno: 'Kashpay',
      supervisorCorreo: `supervisor.${slug || 'comercio'}@subnorte.com`,
      supervisorConfirmarCorreo: `supervisor.${slug || 'comercio'}@subnorte.com`,
      supervisorTelefono: '5512345678',
      perfilReservaNombre: 'Reserva',
      perfilReservaPaterno: 'Operativa',
      perfilReservaMaterno: 'Kashpay',
      perfilReservaCorreo: `reserva.${slug || 'comercio'}@subnorte.com`,
      perfilReservaConfirmarCorreo: `reserva.${slug || 'comercio'}@subnorte.com`,
      perfilReservaTelefono: '5598765432',
      cajasTPV: String(this.buscarNodo(this.arbol, nodoId)?.nivel === 'caja' ? 1 : this.cajasBase),
      tieneSupervisor: 'si',
      pinAdministrador: '1234',
      pinCorreo: `pin.${slug || 'comercio'}@subnorte.com`,
      pinConfirmarCorreo: `pin.${slug || 'comercio'}@subnorte.com`,
      pinContrasena: 'PinTemp123'
    };
  }

  private documentosDesdeRespuesta(respuesta: unknown): DocumentoProspectoApi[] {
    if (!respuesta) return [];
    if (Array.isArray(respuesta)) return respuesta.filter(this.esDocumentoProspecto);
    if (typeof respuesta !== 'object') return [];

    const data = respuesta as DocumentosProspectoResponse;
    if (Array.isArray(data.legalDocuments)) return data.legalDocuments;
    if (Array.isArray(data.documents)) return data.documents;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object' && Array.isArray(data.data.documents)) {
      return data.data.documents;
    }

    return [];
  }

  private esDocumentoProspecto(valor: unknown): valor is DocumentoProspectoApi {
    return !!valor && typeof valor === 'object';
  }

  private documentoRequeridoDesdeProspecto(documentoProspecto: DocumentoProspectoApi, index: number): DocumentoRequerido {
    const nombre = this.nombreDocumentoDesdeProspecto(documentoProspecto);

    return {
      numero: index + 1,
      nombre,
      obligatorio: true,
      archivoNombre: this.nombreDocumentoCargado({ numero: index + 1, nombre, obligatorio: true }, documentoProspecto),
      archivoUrl: this.urlDocumentoCargado(documentoProspecto),
      archivoId: this.idDocumentoCargado(documentoProspecto),
      s3Key: this.s3KeyDocumentoCargado(documentoProspecto),
      tipoArchivo: this.tipoDocumentoCargado(documentoProspecto),
      estado: this.estadoDocumentoCargado(documentoProspecto),
      estatusRevision: this.estatusRevisionDocumento(documentoProspecto),
    };
  }

  private nombreDocumentoDesdeProspecto(documentoProspecto: DocumentoProspectoApi): string {
    const nombre = documentoProspecto.documentName || documentoProspecto.name || documentoProspecto.fileName || documentoProspecto.originalName;
    if (typeof nombre === 'string' && nombre.trim()) return nombre;

    const s3Key = typeof documentoProspecto.s3Key === 'string' ? documentoProspecto.s3Key : '';
    const sufijo = this.sufijoDocumentoDesdeS3Key(s3Key);
    const nombresPorSufijo: Record<string, string> = {
      COMP_DOM: 'Comprobante de domicilio',
      CONS: 'Acta Constitutiva',
      INE: 'Identificación Oficial del Propietario',
      IMGE: 'Imagen Frente',
      IMGI: 'Imagen Interior',
      IMGI2: 'Imagen Interior 2 del comercio',
      CONT: 'Contrato',
      CSF: 'Constancia Situación Fiscal',
      EFIRMA: 'E-Firma',
      ID_REP: 'Identificación Oficial del Representante Legal',
      CAR_EST_CTA: 'Carátula de Estado Cuenta para Liquidación',
      CARTA_LIQ: 'Carta de Liquidación Otros Bancos',
    };

    return nombresPorSufijo[sufijo] ?? this.nombreArchivoDesdeS3Key(s3Key) ?? 'Documento del comercio';
  }

  private sufijoDocumentoDesdeS3Key(s3Key: string): string {
    const archivo = this.nombreArchivoDesdeS3Key(s3Key) ?? '';
    const sinExtension = archivo.replace(/\.[^.]+$/, '');
    const partes = sinExtension.split('_');
    return partes.slice(1).join('_').toUpperCase();
  }

  private nombreArchivoDesdeS3Key(s3Key: string): string | undefined {
    const archivo = s3Key.split('/').pop()?.trim();
    return archivo || undefined;
  }

  private documentoProspectoPara(documento: DocumentoRequerido): DocumentoProspectoApi | undefined {
    const numeroDocumento = String(documento.numero);
    const nombreDocumento = this.normalizarTexto(documento.nombre);

    return this.documentosProspecto.find(documentoProspecto => {
      const id = String(documentoProspecto.documentID ?? documentoProspecto.documentId ?? documentoProspecto.id ?? '');
      const nombre = this.normalizarTexto(
        documentoProspecto.documentName
        || documentoProspecto.name
        || documentoProspecto.fileName
        || documentoProspecto.originalName
        || this.nombreDocumentoDesdeProspecto(documentoProspecto)
        || ''
      );

      return id === numeroDocumento || (!!nombre && (nombre.includes(nombreDocumento) || nombreDocumento.includes(nombre)));
    });
  }

  private nombreDocumentoCargado(documento: DocumentoRequerido, documentoProspecto?: DocumentoProspectoApi): string {
    const nombre = documentoProspecto?.fileName
      || documentoProspecto?.originalName
      || documentoProspecto?.documentName
      || documentoProspecto?.name
      || (typeof documentoProspecto?.s3Key === 'string' ? this.nombreArchivoDesdeS3Key(documentoProspecto.s3Key) : undefined);

    if (typeof nombre === 'string' && nombre.trim()) return nombre;

    return `${documento.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'documento'}-${this.contextoSeleccionado.idComercio || this.nodoSeleccionado}.pdf`;
  }

  private urlDocumentoCargado(documentoProspecto?: DocumentoProspectoApi): string {
    const url = documentoProspecto?.url || documentoProspecto?.fileUrl || documentoProspecto?.path;
    return typeof url === 'string' ? url : '';
  }

  private idDocumentoCargado(documentoProspecto?: DocumentoProspectoApi): string {
    const id = documentoProspecto?.documentID ?? documentoProspecto?.documentId ?? documentoProspecto?.id;
    return id === undefined || id === null ? '' : String(id);
  }

  private tipoDocumentoCargado(documentoProspecto?: DocumentoProspectoApi): string {
    const tipo = documentoProspecto?.documentType;
    return typeof tipo === 'string' ? tipo : '';
  }

  private s3KeyDocumentoCargado(documentoProspecto?: DocumentoProspectoApi): string {
    const s3Key = documentoProspecto?.s3Key;
    return typeof s3Key === 'string' ? s3Key : '';
  }

  private estadoDocumentoCargado(documentoProspecto?: DocumentoProspectoApi): string {
    const estado = documentoProspecto?.status || documentoProspecto?.documentStatus;
    return this.traducirEstatusDocumento(estado);
  }

  private estatusRevisionDocumento(documentoProspecto?: DocumentoProspectoApi): EstatusDocumentoProspecto {
    const estado = documentoProspecto?.status || documentoProspecto?.documentStatus;
    if (estado === 'APPROVED' || estado === 'REJECTED' || estado === 'IN_REVIEW') return estado;
    return 'IN_REVIEW';
  }

  private traducirEstatusDocumento(estado?: string): string {
    if (estado === 'APPROVED') return 'Aprobado';
    if (estado === 'REJECTED') return 'Rechazado';
    if (estado === 'IN_REVIEW') return 'En revisión';
    return 'Subido';
  }

  private estatusDocumentoParaEnvio(documento: DocumentoProspectoApi): EstatusDocumentoProspecto {
    const estado = documento.status || documento.documentStatus;
    if (estado === 'APPROVED' || estado === 'REJECTED' || estado === 'IN_REVIEW') return estado;
    return 'IN_REVIEW';
  }

  private estatusGeneralParaEnvio(estatusDocumentos: EstatusDocumentoProspecto[]): EstatusDocumentoProspecto {
    if (estatusDocumentos.some(estado => estado === 'REJECTED')) return 'REJECTED';
    if (estatusDocumentos.length && estatusDocumentos.every(estado => estado === 'APPROVED')) return 'APPROVED';
    return 'IN_REVIEW';
  }

  private usuarioRevision(): string {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const correo = session?.email || session?.userName || session?.username;
      if (correo) return String(correo);
    } catch {
      // Usa llaves legacy abajo.
    }

    return localStorage.getItem('email') || localStorage.getItem('userName') || '';
  }

  private normalizarTexto(valor?: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private idFakeNodo(nodoId: string): string {
    const registro = this.registroFakePorNodo(nodoId);
    if (registro.idComercio) return registro.idComercio;
    const total = Array.from(nodoId).reduce((acum, letra) => acum + letra.charCodeAt(0), 0);
    return `COM-${String(12000 + total).padStart(8, '0')}`;
  }

  private registroFakePorNodo(nodoId: string): Partial<typeof this.comercioSeleccionado & { razonSocial: string; idComercio: string }> {
    const registros: Record<string, Partial<typeof this.comercioSeleccionado & { razonSocial: string; idComercio: string }>> = {
      'sub-afiliado-1': { idComercio: 'COM-00012842', nivel: 'Sub Afiliado', nombreComercial: 'Sub Afiliado Norte', razonSocial: 'Sub Afiliado Norte SA de CV', rfc: 'SAN010101AA1', correo: 'holding@subnorte.com', telefono: '5510000000' },
      'entidad-1': { idComercio: 'COM-00012843', nivel: 'Entidad', nombreComercial: 'Entidad Financiera México', razonSocial: 'Entidad Financiera México SA', rfc: 'EFM010101BB2', correo: 'entidad01@subnorte.com', telefono: '5510000101' },
      'entidad-2': { idComercio: 'COM-00012839', nivel: 'Entidad', nombreComercial: 'Entidad Financiera Occidente', razonSocial: 'Entidad Financiera Occidente SA', rfc: 'EFO010101CC3', correo: 'entidad02@subnorte.com', telefono: '5510000202' },
      'entidad-1-sucursal-1': { idComercio: 'COM-00012844', nivel: 'Sucursal', nombreComercial: 'Sucursal Toluca Centro', razonSocial: 'Sucursal Toluca Centro SA', rfc: 'STC010101DD4', correo: 'sucursal01.e1@subnorte.com', telefono: '5511010001' },
      'entidad-1-sucursal-2': { idComercio: 'COM-00012840', nivel: 'Sucursal', nombreComercial: 'Sucursal Metepec', razonSocial: 'Sucursal Metepec SA', rfc: 'SME010101EE5', correo: 'sucursal02.e1@subnorte.com', telefono: '5511010002' },
      'entidad-1-sucursal-3': { idComercio: 'COM-00012836', nivel: 'Sucursal', nombreComercial: 'Sucursal Zinacantepec', razonSocial: 'Sucursal Zinacantepec SA', rfc: 'SZI010101FF6', correo: 'sucursal03.e1@subnorte.com', telefono: '5511010003' },
      'entidad-2-sucursal-1': { idComercio: 'COM-00012846', nivel: 'Sucursal', nombreComercial: 'Sucursal Guadalajara Centro', razonSocial: 'Sucursal Guadalajara Centro SA', rfc: 'SGC010101GG7', correo: 'sucursal01.e2@subnorte.com', telefono: '5511020001' },
      'entidad-2-sucursal-2': { idComercio: 'COM-00012847', nivel: 'Sucursal', nombreComercial: 'Sucursal Zapopan', razonSocial: 'Sucursal Zapopan SA', rfc: 'SZA010101HH8', correo: 'sucursal02.e2@subnorte.com', telefono: '5511020002' },
      'entidad-2-sucursal-3': { idComercio: 'COM-00012848', nivel: 'Sucursal', nombreComercial: 'Sucursal Tlaquepaque', razonSocial: 'Sucursal Tlaquepaque SA', rfc: 'STL010101II9', correo: 'sucursal03.e2@subnorte.com', telefono: '5511020003' },
      'entidad-1-sucursal-1-caja-1': { idComercio: 'COM-00012845', nivel: 'Caja', nombreComercial: 'Caja 01 Toluca Centro', razonSocial: 'Caja 01 Toluca Centro SA', rfc: 'C1T010101JJ1', correo: 'caja01.s1e1@subnorte.com', telefono: '5512010101' },
      'entidad-1-sucursal-1-caja-2': { idComercio: 'COM-00012841', nivel: 'Caja', nombreComercial: 'Caja 02 Toluca Centro', razonSocial: 'Caja 02 Toluca Centro SA', rfc: 'C2T010101KK2', correo: 'caja02.s1e1@subnorte.com', telefono: '5512010102' },
      'entidad-1-sucursal-2-caja-1': { idComercio: 'COM-00012837', nivel: 'Caja', nombreComercial: 'Caja 01 Metepec', razonSocial: 'Caja 01 Metepec SA', rfc: 'C1M010101LL3', correo: 'caja01.s2e1@subnorte.com', telefono: '5512010201' }
    };
    return registros[nodoId] ?? {};
  }

  private nombreSucursalFake(entidadId: string, numero: number): string {
    if (entidadId === 'entidad-1') {
      if (numero === 1) return 'Sucursal Toluca Centro';
      if (numero === 2) return 'Sucursal Metepec';
      if (numero === 3) return 'Sucursal Zinacantepec';
    }
    if (entidadId === 'entidad-2') {
      if (numero === 1) return 'Sucursal Guadalajara Centro';
      if (numero === 2) return 'Sucursal Zapopan';
      if (numero === 3) return 'Sucursal Tlaquepaque';
    }
    return `Sucursal ${String(numero).padStart(2, '0')}`;
  }

  private rfcFake(nodoId: string): string {
    const limpio = nodoId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).padEnd(9, 'X');
    return `${limpio}A1`;
  }

  private buscarRuta(nodos: NodoRegistro[], id: string, ruta: string[] = []): string[] {
    for (const nodo of nodos) {
      const nuevaRuta = [...ruta, nodo.nombre];
      if (nodo.id === id) return nuevaRuta;
      const encontrada = this.buscarRuta(nodo.hijos ?? [], id, nuevaRuta);
      if (encontrada.length) return encontrada;
    }
    return [];
  }

  private buscarNodo(nodos: NodoRegistro[], id: string): NodoRegistro | undefined {
    for (const nodo of nodos) {
      if (nodo.id === id) return nodo;
      const encontrado = this.buscarNodo(nodo.hijos ?? [], id);
      if (encontrado) return encontrado;
    }
    return undefined;
  }

  private actualizarValidadoresDatos(): void {
    const activos = new Set(this.camposDatosGenerales);
    Object.values(this.datosForm.controls).forEach(control => control.clearValidators());
    this.camposDatosGenerales.forEach(campo => {
      const control = this.datosForm.get(campo);
      if (control && !['numeroExterior', 'numeroInterior', 'entreCalle', 'yCalle'].includes(campo)) control.setValidators([Validators.required]);
    });
    ['codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial'].forEach(campo => this.datosForm.get(campo)?.setValidators([Validators.required]));
    this.datosForm.controls.correoComercial.setValidators([Validators.required, Validators.email]);
    this.datosForm.controls.telefonoComercial.setValidators([Validators.required]);
    Object.entries(this.datosForm.controls).forEach(([nombre, control]) => {
      if (!activos.has(nombre) && nombre === 'correo') control.setValidators([Validators.email]);
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidadoresBeneficiario(tipo: TipoPersonaBeneficiario): void {
    const paterno = this.liquidacionForm.controls.apellidoPaternoBeneficiario;
    const materno = this.liquidacionForm.controls.apellidoMaternoBeneficiario;
    paterno.setValidators(tipo === 'fisica' ? [Validators.required] : []);
    materno.setValidators(tipo === 'fisica' ? [Validators.required] : []);
    paterno.updateValueAndValidity({ emitEvent: false });
    materno.updateValueAndValidity({ emitEvent: false });
    this.liquidacionForm.controls.actividadBeneficiario.setValidators(tipo === 'fisica' ? [Validators.required] : []);
    this.liquidacionForm.controls.giroBeneficiario.setValidators(tipo === 'moral' ? [Validators.required] : []);
    this.liquidacionForm.controls.actividadBeneficiario.updateValueAndValidity({ emitEvent: false });
    this.liquidacionForm.controls.giroBeneficiario.updateValueAndValidity({ emitEvent: false });
  }

  private limpiarDatosBeneficiarioLiquidacion(): void {
    this.liquidacionForm.patchValue({
      nombreBeneficiario: '',
      apellidoPaternoBeneficiario: '',
      apellidoMaternoBeneficiario: '',
      correoBeneficiario: '',
      direccionBeneficiario: '',
      rfcBeneficiario: '',
      actividadBeneficiario: '',
      giroBeneficiario: '',
    }, { emitEvent: false });
  }

  private actualizarEstadoLiquidacionRegistro(): void {
    const requiereDatos = ['otros-bancos', 'otros-bancos-en-red'].includes(this.liquidacionForm.controls.cuentaFueraRed.value);
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
      this.liquidacionForm.controls.tipoCuenta,
      this.liquidacionForm.controls.cuentaClabe,
      this.liquidacionForm.controls.nombreBanco,
      this.liquidacionForm.controls.direccionBanco,
      this.liquidacionForm.controls.telefonoBanco,
      this.liquidacionForm.controls.emailBanco,
    ];

    if (!requiereDatos) {
      controles.forEach(control => {
        control.clearValidators();
        control.disable({ emitEvent: false });
        control.updateValueAndValidity({ emitEvent: false });
      });
      this.liquidacionForm.patchValue({
        beneficiarioIgualComercio: false,
        tipoCuenta: '',
        cuentaClabe: '',
        nombreBanco: '',
        direccionBanco: '',
        telefonoBanco: '',
        emailBanco: '',
      }, { emitEvent: false });
      this.limpiarDatosBeneficiarioLiquidacion();
      return;
    }

    controles.forEach(control => control.enable({ emitEvent: false }));
    this.liquidacionForm.controls.nombreBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.correoBeneficiario.setValidators([Validators.required, Validators.email]);
    this.liquidacionForm.controls.direccionBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.rfcBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.tipoCuenta.setValidators([Validators.required]);
    this.liquidacionForm.controls.cuentaClabe.setValidators([Validators.required]);
    this.liquidacionForm.controls.nombreBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.direccionBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.telefonoBanco.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
    this.liquidacionForm.controls.emailBanco.setValidators([Validators.required, Validators.email]);
    this.actualizarValidadoresBeneficiario(this.liquidacionForm.controls.tipoPersonaBeneficiario.value as TipoPersonaBeneficiario);
    controles.forEach(control => control.updateValueAndValidity({ emitEvent: false }));
  }

  private actualizarValidadoresAccesosRegistro(): void {
    const prefijos: PrefijoAccesoRegistro[] = ['admin', 'fac', 'tkt', 'controlador', 'supervisor'];
    const activos = new Set([this.usuarioAccesoActivo]);
    const campos = ['Nombre', 'Paterno', 'Materno', 'Correo', 'ConfirmarCorreo', 'Telefono'] as const;

    prefijos.forEach(prefijo => {
      campos.forEach(campo => {
        const control = this.accesosForm.get(`${prefijo}${campo}`);
        if (!control) return;

        if (!activos.has(prefijo)) {
          control.clearValidators();
          if (campo === 'Correo' || campo === 'ConfirmarCorreo') control.setValidators([Validators.email]);
          control.updateValueAndValidity({ emitEvent: false });
          return;
        }

        if (campo === 'Correo' || campo === 'ConfirmarCorreo') {
          control.setValidators([Validators.required, Validators.email]);
        } else if (campo === 'Telefono') {
          control.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
        } else {
          control.setValidators([Validators.required]);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });

    this.accesosForm.updateValueAndValidity({ emitEvent: false });
  }

  private asegurarUsuarioAccesoActivo(): void {
    const usuarios = this.usuariosAcceso.map(usuario => usuario.prefijo as PrefijoAccesoRegistro);
    if (usuarios.length && !usuarios.includes(this.usuarioAccesoActivo)) {
      this.usuarioAccesoActivo = usuarios[0];
    }
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const datos = this.datosForm.getRawValue();
    this.liquidacionForm.patchValue({
      nombreBeneficiario: datos.nombre || datos.razonSocial || datos.nombreComercial,
      apellidoPaternoBeneficiario: datos.apellidoPaterno,
      apellidoMaternoBeneficiario: datos.apellidoMaterno,
      correoBeneficiario: datos.correoComercial || datos.correo,
      direccionBeneficiario: [datos.nombreVialidadComercial, datos.coloniaComercial, datos.municipioComercial].filter(Boolean).join(', '),
      rfcBeneficiario: datos.rfc,
      actividadBeneficiario: datos.actividad,
      giroBeneficiario: datos.giroComercial
    }, { emitEvent: false });
  }

  private camposCoincidenValidator(origen: string, confirmacion: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const a = control.get(origen)?.value;
      const b = control.get(confirmacion)?.value;
      return a && b && a !== b ? { [errorKey]: true } : null;
    };
  }
}
