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
import { TipoNegocio, TiposNegocioComponent } from './components/tipos-negocio/tipos-negocio.component';
import { ArbolNegocioComponent } from './components/arbol-negocio/arbol-negocio.component';

// ── Tipos locales ─────────────────────────────────────────────────────────────
type PasoWizard = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type TipoComisionista = 'existente' | 'nuevo';
type ReglaDocumento = Pick<DocumentoRequerido, 'numero' | 'obligatorio'>;
type NivelArbolNegocio = 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja';

interface NodoArbolNegocio {
  id: string;
  nombre: string;
  nivel: NivelArbolNegocio;
  ruta: string;
  hijos?: NodoArbolNegocio[];
}

interface ConfiguracionArbolNegocio {
  nivelPadre: 'Sub Afiliado' | 'Entidad' | 'Sucursal';
  mostrarEntidades: boolean;
  mostrarSucursales: boolean;
  mostrarCajas: boolean;
  entidadesBase: number;
  sucursalesBase: number;
  cajasBase: number;
}

interface BorradorPreRegistro {
  pasoActual: PasoWizard;
  pasosCompletados: number[];
  registroTerminado: boolean;
  afiliacion: { afiliacion: string };
  comercio: { nivel: string; tipoComercio: string; afiliacionComisionista: string };
  arbolNegocio: { numeroEntidades: string; numeroSucursales: string; numeroCajas: string; ubicacionSeleccionada: string; nivelSeleccionado: string; sucursalesPorEntidad: string; cajasPorSucursal: string; nombresArbol: string; nodosColapsados: string; nodosCompletados: string; nodoSeleccionado: string; datosPorSucursal: string; comercioPorNodo: string };
  comisionista: Record<string, string>;
  datos: Record<string, string | boolean>;
  accesos: Record<string, string | boolean>;
  liquidacion: Record<string, string | boolean>;
  documentos: Array<{ numero: number; archivoNombre?: string }>;
}

type DocumentoNodo = Pick<DocumentoRequerido, 'archivo' | 'archivoNombre'>;

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
    TiposNegocioComponent,
    ArbolNegocioComponent,
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
  tipoNegocioSeleccionado?: TipoNegocio;
  private documentosPorNodo: Record<string, Record<number, DocumentoNodo>> = {};
  private contextoComercio: 'paquete' | 'caja' = 'paquete';


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
  private readonly bancosPorClaveClabe: Record<string, string> = {
    '002': 'BANAMEX',
    '006': 'BANCOMEXT',
    '009': 'BANOBRAS',
    '012': 'BBVA MEXICO',
    '014': 'SANTANDER',
    '019': 'BANJERCITO',
    '021': 'HSBC',
    '030': 'BAJIO',
    '032': 'IXE',
    '036': 'INBURSA',
    '042': 'MIFEL',
    '044': 'SCOTIABANK',
    '058': 'BANREGIO',
    '059': 'INVEX',
    '060': 'BANSI',
    '062': 'AFIRME',
    '072': 'BANORTE',
    '106': 'BANK OF AMERICA',
    '108': 'MUFG',
    '110': 'JP MORGAN',
    '112': 'BMONEX',
    '113': 'VE POR MAS',
    '127': 'AZTECA',
    '128': 'AUTOFIN',
    '129': 'BARCLAYS',
    '130': 'COMPARTAMOS',
    '132': 'MULTIVA',
    '133': 'ACTINVER',
    '136': 'INTERCAM BANCO',
    '137': 'BANCOPPEL',
    '138': 'ABC CAPITAL',
    '140': 'CONSUBANCO',
    '141': 'VOLKSWAGEN',
    '143': 'CIBANCO',
    '145': 'BBASE',
    '147': 'BANKAOOL',
    '148': 'PAGATODO',
    '150': 'INMOBILIARIO',
    '152': 'BANCREA',
    '154': 'BANCO COVALTO',
    '156': 'SABADELL',
    '157': 'SHINHAN',
    '158': 'MIZUHO BANK',
    '160': 'BANCO S3',
    '166': 'BANCO FINTERRA',
    '168': 'HIPOTECARIA FEDERAL',
    '600': 'MONEXCB',
    '601': 'GBM',
    '602': 'MASARI',
    '605': 'VALUE',
    '606': 'ESTRUCTURADORES',
    '608': 'VECTOR',
    '610': 'B&B',
    '614': 'ACCIVAL',
    '616': 'FINAMEX',
    '617': 'VALMEX',
    '618': 'UNICA',
    '619': 'MAPFRE',
    '620': 'PROFUTURO',
    '621': 'CB ACTINVER',
    '622': 'OACTIN',
    '623': 'SKANDIA',
    '626': 'CBDEUTSCHE',
    '627': 'ZURICH',
    '628': 'ZURICHVI',
    '629': 'SU CASITA',
    '630': 'CB INTERCAM',
    '631': 'CI BOLSA',
    '632': 'BULLTICK CB',
    '633': 'STERLING',
    '634': 'FINCOMUN',
    '636': 'HDI SEGUROS',
    '637': 'ORDER',
    '638': 'AKALA',
    '640': 'CB JPMORGAN',
    '642': 'REFORMA',
    '646': 'STP',
    '647': 'TELECOMM',
    '648': 'EVERCORE',
    '649': 'SKANDIA',
    '651': 'SEGMTY',
    '652': 'ASEA',
    '653': 'KUSPIT',
    '655': 'SOFIEXPRESS',
    '656': 'UNAGRA',
    '659': 'OPCIONES EMPRESARIALES DEL NOROESTE',
    '670': 'LIBERTAD',
    '677': 'CAJA POP MEXICA',
    '680': 'CRISTOBAL COLON',
    '683': 'CAJA TELEFONIST',
    '684': 'TRANSFER',
    '685': 'FONDO',
    '686': 'INVERCAP',
    '689': 'FOMPED',
  };
  readonly departamentos = ['Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Atlántico'];
  readonly ciudades = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla'];
  readonly regimenesFiscales: string[] = [
    '601 - General de Ley Personas Morales',
    '603 - Personas Morales con Fines no Lucrativos',
    '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
    '606 - Arrendamiento',
    '607 - Régimen de Enajenación o Adquisición de Bienes',
    '608 - Demás ingresos',
    '610 - Residentes en el Extranjero sin Establecimiento Permanente en México',
    '611 - Ingresos por Dividendos (socios y accionistas)',
    '612 - Personas Físicas con Actividades Empresariales y Profesionales',
    '614 - Ingresos por intereses',
    '615 - Régimen de los ingresos por obtención de premios',
    '616 - Sin obligaciones fiscales',
    '620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    '621 - Incorporación Fiscal',
    '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    '623 - Opcional para Grupos de Sociedades',
    '624 - Coordinados',
    '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    '626 - Régimen Simplificado de Confianza',
  ];
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
    'Caja': ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'],
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
    'Cuenta Entidad': [], 'Cuenta Terminal': [], 'Cuenta Terminal Pin Rapido': [],
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

  readonly documentosPorTipoComercio: Record<string, ReglaDocumento[]> = {
    'Empresa Holding': [
      { numero: 1, obligatorio: true },
      { numero: 2, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 8, obligatorio: false },
      { numero: 9, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
      { numero: 12, obligatorio: false },
      { numero: 13, obligatorio: false },
    ],
    'Empresa Grupo': [
      { numero: 1, obligatorio: true },
      { numero: 2, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 8, obligatorio: false },
      { numero: 9, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
      { numero: 12, obligatorio: false },
      { numero: 13, obligatorio: false },
    ],
    'Sucursales de Grupo': [
      { numero: 1, obligatorio: true },
      { numero: 2, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 8, obligatorio: false },
      { numero: 9, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
      { numero: 12, obligatorio: false },
      { numero: 13, obligatorio: false },
    ],
    'Persona Física': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
    ],
    'Sucursal Persona Física': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
    ],
    'Referenciador': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
    ],
    'Comisionista': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
      { numero: 10, obligatorio: false },
      { numero: 11, obligatorio: false },
    ],
    'Sucursales Únicas': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: false },
      { numero: 6, obligatorio: false },
      { numero: 7, obligatorio: false },
    ],
    'Caja con Tarjeta sólo Fondeo': [],
    'Caja con Tarjeta SPEI': [],
    'Cuenta Entidad': [],
    'Cuenta Terminal': [],
    'Cuenta Terminal Pin Rapido': [],
  };

  // ── Formularios ──────────────────────────────────────────────────────────────
  readonly afiliacionForm = this.fb.nonNullable.group({
    afiliacion: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
  });

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: [''],
  });

  readonly arbolNegocioForm = this.fb.nonNullable.group({
    numeroEntidades: ['1', [Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]],
    numeroSucursales: ['1', [Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]],
    numeroCajas: ['1', [Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]],
    ubicacionSeleccionada: [''],
    nivelSeleccionado: [''],
    sucursalesPorEntidad: [''],
    cajasPorSucursal: [''],
    nombresArbol: [''],
    nodosColapsados: [''],
    nodosCompletados: [''],
    nodoSeleccionado: [''],
    datosPorSucursal: [''],
    comercioPorNodo: [''],
    accesosPorSucursal: [''],
  });

  readonly datosForm = this.fb.nonNullable.group({
    razonSocial: [''], nombreComercial: [''], rfc: [''],
    regimenFiscal: [''], giroComercial: [''], descripcionGiro: [''], mcc: [''],
    mismaInfoFiscalEntidad: [false],
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




    codigoPostalComercial: ['', Validators.required],
    tipoVialidadComercial: ['', Validators.required],
    nombreVialidadComercial: ['', Validators.required],
    numeroExteriorComercial: [''],
    numeroInteriorComercial: [''],
    coloniaComercial: ['', Validators.required],
    localidadComercial: ['', Validators.required],
    municipioComercial: ['', Validators.required],
    entidadFederativaComercial: ['', Validators.required],
    entreCalleComercial: [''],
    yCalleComercial: [''],

    correoComercial: ['', [Validators.required, Validators.email]],
    telefonoComercial: ['', [Validators.required, Validators.pattern(/^[0-9\s()+-]{7,20}$/)]],
    telefonoAdicionalComercial: [''],



  });

  private readonly camposDinamicosOpcionales = ['numeroExterior', 'numeroInterior', 'entreCalle', 'yCalle'];
  private readonly camposInfoFiscalEntidad = [
    'razonSocial', 'nombreComercial', 'rfc', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc',
    'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad',
    'tipoPersona', 'correo', 'telefono', 'departamento', 'ciudad', 'direccionComercial',
    'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior',
    'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle',
    'nombreRepresentante', 'apellidoPaternoRepresentante', 'apellidoMaternoRepresentante',
    'calleRepresentante', 'numeroExteriorRepresentante', 'numeroInteriorRepresentante',
    'codigoPostalRepresentante', 'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante',
    'correoRepresentante', 'telefonoRepresentante', 'telefonoAdicionalRepresentante',
  ];
  private readonly todosCamposDinamicos: string[] = Array.from(
    new Set(Object.values(this.datosGeneralesPorTipo).flat())
  );



  private readonly nivelesSinRepresentante = ['Persona Física', 'Sucursal Persona Física', 'Sucursales Únicas', 'Referenciador', 'Comisionista'];
  private readonly tiposCaja = ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'];
  private readonly camposRepresentanteObligatorios = ['nombreRepresentante', 'apellidoPaternoRepresentante', 'apellidoMaternoRepresentante', 'calleRepresentante', 'codigoPostalRepresentante', 'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante'];

  private get mostrarRepresentante(): boolean {
    const nivel = this.comercioForm.getRawValue().nivel;
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);
    const tipoEfectivo = esSinTipo ? nivel : tipo;
    const esCaja = this.tiposCaja.includes(tipoEfectivo);
    return !esCaja && !this.nivelesSinRepresentante.includes(tipoEfectivo);
  }

  private actualizarValidadoresDatos(): void {
    const activos = new Set(this.camposDatosGenerales);
    this.todosCamposDinamicos.forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      const debeSerObligatorio = activos.has(nombre) && !this.camposDinamicosOpcionales.includes(nombre);
      control.setValidators(debeSerObligatorio ? [Validators.required] : []);
      control.updateValueAndValidity({ emitEvent: false });
    });






    const controlesCondicionales = [
      'tipoPersona',
      'correo',
      'telefono',
      'departamento',
      'ciudad',
      'direccionComercial'
    ];

    controlesCondicionales.forEach(nombre => {

      const control = this.datosForm.get(nombre);

      if (!control) return;

      const obligatorio = this.camposDatosGenerales.includes(nombre);

      control.setValidators(obligatorio ? [Validators.required] : []);

      control.updateValueAndValidity({ emitEvent: false });

    });












    const mostrarRep = this.mostrarRepresentante;
    this.camposRepresentanteObligatorios.forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      control.setValidators(mostrarRep ? [Validators.required] : []);
      control.updateValueAndValidity({ emitEvent: false });
    });

    const correoRep = this.datosForm.get('correoRepresentante');
    correoRep?.setValidators(mostrarRep ? [Validators.required, Validators.email] : []);
    correoRep?.updateValueAndValidity({ emitEvent: false });

    const telRep = this.datosForm.get('telefonoRepresentante');
    telRep?.setValidators(mostrarRep ? [Validators.required, Validators.pattern(/^[0-9\s()+-]{7,20}$/)] : []);
    telRep?.updateValueAndValidity({ emitEvent: false });

    if (this.pasoGeneralesDebeSaltarse && this.liquidacionForm.controls.beneficiarioIgualComercio.value) {
      this.liquidacionForm.controls.beneficiarioIgualComercio.setValue(false, { emitEvent: false });
      this.actualizarEstadoLiquidacion(false);
    }

  }

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
    cuentaClabe: ['', Validators.required],
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
      .subscribe(tipo => {
        this.tipoPersonaBeneficiario = tipo as TipoPersonaBeneficiario;
        this.actualizarValidadoresBeneficiario(tipo as TipoPersonaBeneficiario);
      });

    this.liquidacionForm.controls.tipoCuenta.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tipo => this.actualizarValidadorCuentaLiquidacion(tipo));

    this.liquidacionForm.controls.cuentaClabe.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(clabe => this.actualizarBancoDesdeClabe(clabe));

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
        this.actualizarValidadoresDatos();
      });

    this.comercioForm.controls.tipoComercio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarValidadoresDatos()); // 👈 antes no hacía nada

    //this.cargarBorrador();
    try { localStorage.removeItem(this.draftKey); } catch { /* no-op */ }
    this.tiposComercio = this.tiposComercioPorNivel[this.comercioForm.controls.nivel.value] ?? [];
    this.actualizarValidadoresDatos();
    this.actualizarValidadorCuentaLiquidacion(this.liquidacionForm.controls.tipoCuenta.value);


  }

  // ── Getters ──────────────────────────────────────────────────────────────────
  get progresoWizard(): number {
    if (this.pasoActual === 0) return 0;
    const indiceActual = this.pasosVisibles.findIndex(paso => paso.numero === this.pasoActual);
    const indice = indiceActual >= 0 ? indiceActual : this.pasosVisibles.length - 1;
    return (indice / Math.max(this.pasosVisibles.length - 1, 1)) * 100;
  }

  get documentosVisibles(): DocumentoRequerido[] {
    const nivel = this.comercioForm.getRawValue().nivel;
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const tipoEfectivo = ['Referenciador', 'Comisionista'].includes(nivel) ? nivel : tipo;
    const reglas = this.documentosPorTipoComercio[tipoEfectivo] ?? [];

    return reglas
      .map(regla => {
        const documento = this.documentos.find(d => d.numero === regla.numero);
        if (!documento) return undefined;
        documento.obligatorio = regla.obligatorio;
        return documento;
      })
      .filter((documento): documento is DocumentoRequerido => !!documento);
  }


  get camposDatosGenerales(): string[] {
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const nivel = this.comercioForm.getRawValue().nivel;
    const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);
    return this.datosGeneralesPorTipo[esSinTipo ? nivel : tipo] ?? [];
  }

  get pasoGeneralesDebeSaltarse(): boolean {
    return this.camposDatosGenerales.length === 0;
  }

  get pasosVisibles() {
    return this.pasos.filter(paso =>
      (paso.numero !== 2 || !this.pasoGeneralesDebeSaltarse) &&
      (paso.numero !== 4 || this.mostrarCuentaLiquidacion) &&
      (paso.numero !== 5 || this.mostrarPasoDocumentos)
    );
  }

  get mostrarAdminTotal(): boolean { return this.modoReservaActual !== 'COMPLETO'; }
  get mostrarPerfilReserva(): boolean { return this.modoReservaActual !== 'NINGUNO'; }
  get mostrarReservaSplit(): boolean { return this.modoReservaActual === 'TRANSACCIONAL'; }
  get mostrarPinSupervisor(): boolean { return this.accesosForm.controls.tieneSupervisor.value === 'si'; }
  get mostrarCuentaLiquidacion(): boolean { return false; }
  get mostrarPasoDocumentos(): boolean { return this.documentosVisibles.length > 0; }
  get mostrarBeneficiarioIgualComercio(): boolean { return !this.pasoGeneralesDebeSaltarse; }
  get esComercioUnico(): boolean { return this.tipoNegocioSeleccionado?.id === 'comercio-unico'; }
  get bloquearNivelComercio(): boolean { return !!this.tipoNegocioSeleccionado || this.contextoComercio === 'caja'; }
  get bloquearTipoComercio(): boolean { return this.esComercioUnico && this.contextoComercio !== 'caja'; }
  get nivelesComercioVisibles(): string[] {
    const nivelActual = this.comercioForm.controls.nivel.value;
    return this.bloquearNivelComercio && nivelActual ? [nivelActual] : this.niveles;
  }
  get mostrarInfoFiscalEntidadSucursal(): boolean {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    return !this.esComercioUnico && nodo?.nivel === 'sucursal' && !!this.buscarEntidadPadre(nodo.id);
  }
  get pasoActualLabel(): string { return this.pasos[this.pasoActual - 1]?.titulo ?? 'Validación'; }
  get documentosCargados(): number { return this.documentosVisibles.filter(d => !!(d.archivo || d.archivoNombre)).length; }
  get documentosPendientes(): number { return this.documentosVisibles.filter(d => d.obligatorio && !d.archivo).length; }
  get mostrarArbolWizard(): boolean { return this.requiereArbolNegocio(); }
  get textoBotonDocumentos(): string {
    return this.mostrarArbolWizard && this.hayNodoSiguienteArbol() ? 'Siguiente' : 'Enviar preregistro';
  }
  get ubicacionArbolSeleccionada(): string {
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    return this.formatearRutaNodoDesdeDatos(nodoId)
      || this.buscarNodoArbol(nodoId)?.ruta
      || this.arbolNegocioForm.controls.ubicacionSeleccionada.value;
  }
  get nivelArbolSeleccionado(): string { return this.arbolNegocioForm.controls.nivelSeleccionado.value; }
  get configuracionArbol(): ConfiguracionArbolNegocio {
    const id = this.tipoNegocioSeleccionado?.id;
    if (id === 'empresa-holding') {
      return { nivelPadre: 'Sub Afiliado', mostrarEntidades: true, mostrarSucursales: true, mostrarCajas: true, entidadesBase: 1, sucursalesBase: 1, cajasBase: 1 };
    }
    if (id === 'sucursales-multiples') {
      return { nivelPadre: 'Entidad', mostrarEntidades: false, mostrarSucursales: true, mostrarCajas: true, entidadesBase: 1, sucursalesBase: 1, cajasBase: 1 };
    }
    if (id === 'auditor-unico') {
      return { nivelPadre: 'Sucursal', mostrarEntidades: false, mostrarSucursales: true, mostrarCajas: true, entidadesBase: 1, sucursalesBase: 1, cajasBase: 1 };
    }
    return { nivelPadre: 'Sucursal', mostrarEntidades: false, mostrarSucursales: false, mostrarCajas: true, entidadesBase: 1, sucursalesBase: 1, cajasBase: 1 };
  }
  get nombreNivelPadreArbol(): string { return this.nombreNodoArbol('nivel-padre', this.configuracionArbol.nivelPadre); }
  get nombreSucursalesArbol(): string { return this.nombreNodoArbol('sucursales', 'Sucursal'); }
  get mostrarCarpetaSucursales(): boolean { return this.nombreNivelPadreArbol.toLowerCase() !== 'sucursal'; }
  get detalleUbicacionArbolSeleccionada(): string {
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    const datos = this.obtenerDatosPorSucursal()[nodoId];
    if (!datos) return '';
    return `${datos['direccionComercial'] || datos['nombreVialidadComercial'] || datos['nombreVialidad'] || ''}`.trim();
  }

  get arbolNegocioWizard(): NodoArbolNegocio[] {
    const config = this.configuracionArbol;
    if (config.nivelPadre === 'Sub Afiliado') {
      const entidades = this.numeroEntero(this.arbolNegocioForm.controls.numeroEntidades.value, 1);
      return [{
        id: 'sub-afiliado-1',
        nombre: this.nombreNodoArbol('sub-afiliado-1', 'Sub Afiliado 01'),
        nivel: 'sub-afiliado',
        ruta: this.nombreNodoArbol('sub-afiliado-1', 'Sub Afiliado 01'),
        hijos: Array.from({ length: entidades }, (_, entidadIndex) => this.crearEntidadArbol(entidadIndex, `sub-afiliado-1`)),
      }];
    }

    if (config.nivelPadre === 'Entidad') {
      const entidades = config.mostrarEntidades
        ? this.numeroEntero(this.arbolNegocioForm.controls.numeroEntidades.value, 1)
        : 1;
      return Array.from({ length: entidades }, (_, entidadIndex) => this.crearEntidadArbol(entidadIndex));
    }

    const sucursales = this.numeroEntero(this.arbolNegocioForm.controls.numeroSucursales.value, 1);
    return Array.from({ length: sucursales }, (_, sucursalIndex) => {
      return this.crearSucursalArbol(sucursalIndex);
    });
  }

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

  abrirPaso(paso: number): void {
    if (!this.puedeAbrirPaso(paso)) return;
    this.irAlPaso(paso);
  }

  volver(paso: PasoWizard): void { this.irAlPaso(paso); }
  esPasoCompletado(paso: number): boolean { return this.pasosCompletados.has(paso); }
  puedeAbrirPaso(paso: number): boolean {
    if (paso === this.pasoActual || this.esPasoCompletado(paso)) return true;
    const actual = this.pasosVisibles.findIndex(p => p.numero === this.pasoActual);
    const destino = this.pasosVisibles.findIndex(p => p.numero === paso);
    return actual >= 0 && destino >= 0 && destino < actual;
  }
  private marcarPasoCompletado(paso: number): void { this.pasosCompletados.add(paso); }

  seleccionarNodoArbol(nodo: NodoArbolNegocio): void {
    this.guardarCapturaNodoActual();
    this.guardarComercioNodoActual();

    this.arbolNegocioForm.patchValue({
      ubicacionSeleccionada: nodo.ruta,
      nivelSeleccionado: nodo.nivel,
      nodoSeleccionado: nodo.id,
    });

    this.aplicarComercioPorNodo(nodo);
    this.cargarCapturaNodoCompleta(nodo.id);

    this.guardarBorradorSilencioso();
  }

  private aplicarComercioPorNodo(nodo: NodoArbolNegocio): void {
    const nivel = this.nivelClientePorNodo(nodo);
    const comercioGuardado = this.obtenerComercioPorNodo()[nodo.id];
    this.contextoComercio = nodo.nivel === 'caja' ? 'caja' : 'paquete';
    this.tiposComercio = this.esComercioUnico && nodo.nivel !== 'caja'
      ? [this.tipoNegocioSeleccionado?.tipoComercio || 'Sucursales Únicas']
      : this.tiposComercioPorNivel[nivel] ?? [];
    this.comercioForm.patchValue({
      nivel,
      tipoComercio: comercioGuardado?.tipoComercio
        || (this.esComercioUnico && nodo.nivel !== 'caja' ? this.tipoNegocioSeleccionado?.tipoComercio || 'Sucursales Únicas' : ''),
    }, { emitEvent: false });
    this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
    this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
    this.actualizarValidadoresDatos();
    this.pasosCompletados.delete(1);
    this.pasosCompletados.delete(2);
    this.pasosCompletados.delete(3);
    this.pasosCompletados.delete(5);
    this.pasoActual = 1;
  }

  esNodoArbolSeleccionado(nodo: NodoArbolNegocio): boolean {
    return this.arbolNegocioForm.controls.nodoSeleccionado.value === nodo.id;
  }

  cambiarCajasSucursal(sucursalId: string, cambio: number, totalActual?: number): void {
    if (this.esComercioUnico) return;
    const cajas = this.obtenerCajasPorSucursal();
    cajas[sucursalId] = Math.max(1, (totalActual ?? cajas[sucursalId] ?? 1) + cambio);
    this.guardarCajasPorSucursal(cajas);
    this.guardarBorradorSilencioso();
  }

  cambiarSucursalesEntidad(indiceEntidad: number, cambio: number): void {
    const sucursales = this.obtenerSucursalesPorEntidad();
    sucursales[indiceEntidad] = Math.max(1, (sucursales[indiceEntidad] ?? 1) + cambio);
    this.guardarSucursalesPorEntidad(sucursales);
    this.guardarBorradorSilencioso();
  }

  alternarNodoArbol(id: string): void {
    const colapsados = new Set(this.obtenerNodosColapsados());
    if (colapsados.has(id)) {
      colapsados.delete(id);
    } else {
      colapsados.add(id);
    }
    this.arbolNegocioForm.controls.nodosColapsados.setValue(JSON.stringify([...colapsados]), { emitEvent: false });
    this.guardarBorradorSilencioso();
  }

  nodoArbolExpandido(id: string): boolean {
    return !this.obtenerNodosColapsados().includes(id);
  }

  renombrarNodoArbol(id: string, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const nombre = input.value.trim();
    if (!nombre) return;
    const nombres = this.obtenerNombresArbol();
    nombres[id] = nombre;
    this.arbolNegocioForm.controls.nombresArbol.setValue(JSON.stringify(nombres), { emitEvent: false });
    const seleccionado = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    if (seleccionado) {
      this.arbolNegocioForm.controls.ubicacionSeleccionada.setValue(seleccionado.ruta, { emitEvent: false });
    }
    this.guardarBorradorSilencioso();
  }

  // ── Continuar ─────────────────────────────────────────────────────────────────
  continuarAfiliacion(): void {
    if (this.afiliacionForm.invalid) { this.afiliacionForm.markAllAsTouched(); return; }
    this.guardarBorradorSilencioso(); this.irAlPaso(6);
  }

  seleccionarTipoNegocio(tipo: TipoNegocio): void {
    this.tipoNegocioSeleccionado = tipo;
    this.contextoComercio = 'paquete';
    this.comercioForm.patchValue({
      nivel: tipo.nivel,
      tipoComercio: tipo.tipoComercio,
    });
    this.tiposComercio = tipo.id === 'comercio-unico'
      ? [tipo.tipoComercio]
      : this.tiposComercioPorNivel[tipo.nivel] ?? [];
    if (this.requiereArbolNegocio(tipo)) {
      this.configurarArbolPorTipo(tipo);
      this.arbolNegocioForm.patchValue({
        numeroEntidades: this.arbolNegocioForm.controls.numeroEntidades.value || '1',
        numeroSucursales: this.arbolNegocioForm.controls.numeroSucursales.value || '1',
        numeroCajas: tipo.id === 'comercio-unico' ? '1' : this.arbolNegocioForm.controls.numeroCajas.value || '1',
        cajasPorSucursal: tipo.id === 'comercio-unico' ? JSON.stringify([1]) : this.arbolNegocioForm.controls.cajasPorSucursal.value,
      });
      this.guardarBorradorSilencioso();
      if (!this.requierePantallaArbolNegocio(tipo)) {
        const primerNodo = this.primerNodoCapturableArbol();
        this.arbolNegocioForm.patchValue({
          ubicacionSeleccionada: primerNodo?.ruta || 'Sucursal 01',
          nivelSeleccionado: primerNodo?.nivel || 'sucursal',
          nodoSeleccionado: primerNodo?.id || 'sucursal-1',
        }, { emitEvent: false });
        if (primerNodo) this.aplicarComercioPorNodo(primerNodo);
        this.irAlPaso(1);
        return;
      }
      this.irAlPaso(7);
      return;
    }
    this.continuarComercio();
  }

  continuarArbolNegocio(): void {
    this.arbolNegocioForm.markAllAsTouched();
    if (this.arbolNegocioForm.invalid) return;
    this.sincronizarCajasPorSucursal();
    if (!this.arbolNegocioForm.controls.ubicacionSeleccionada.value) {
      const primerNodo = this.primerNodoCapturableArbol();
      this.arbolNegocioForm.patchValue({
        ubicacionSeleccionada: primerNodo?.ruta || 'Sucursal 01',
        nivelSeleccionado: primerNodo?.nivel || 'sucursal',
        nodoSeleccionado: primerNodo?.id || 'sucursal-1',
      });
      if (primerNodo) this.cargarCapturaNodo(primerNodo.id);
    }
    this.accesosForm.controls.cajasTPV.setValue(String(Math.max(...Object.values(this.obtenerCajasPorSucursal()))));
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value) || this.primerNodoCapturableArbol();
    if (nodo) this.aplicarComercioPorNodo(nodo);
    this.irAlPaso(1);
  }

  /* continuarComercio(): void {
     if (this.comercioForm.invalid) { this.comercioForm.markAllAsTouched(); return; }
     this.marcarPasoCompletado(1); this.guardarBorradorSilencioso(); this.irAlPaso(2);
   }*/

  continuarComercio(): void {
    if (this.comercioForm.invalid) { this.comercioForm.markAllAsTouched(); return; }
    this.guardarComercioNodoActual();
    this.marcarPasoCompletado(1);
    this.guardarBorradorSilencioso();
    if (this.pasoGeneralesDebeSaltarse) {
      this.marcarPasoCompletado(2); // paso 2 se auto-completa
      this.irAlPaso(3);
    } else {
      const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
      this.cargarDatosSucursal(nodoId);
      this.irAlPaso(2);
    }
  }

  continuarDatos(): void {
     if (this.datosForm.invalid) { this.datosForm.markAllAsTouched(); return; }
     this.guardarDatosSucursalActual();
     this.marcarPasoCompletado(2); this.guardarBorradorSilencioso(); this.irAlPaso(3);
   }

  alternarInfoFiscalEntidad(usarInfoEntidad: boolean): void {
    this.datosForm.controls.mismaInfoFiscalEntidad.setValue(usarInfoEntidad, { emitEvent: false });
    if (usarInfoEntidad) {
      this.copiarInfoFiscalDesdeEntidad();
    } else {
      this.limpiarInfoFiscalEntidad();
    }
    this.actualizarEstadoInfoFiscalEntidad();
    this.guardarBorradorSilencioso();
  }

  volverDesdeComercio(): void {
    this.irAlPaso(this.requierePantallaArbolNegocio() ? 7 : 6);
  }

  volverDesdeAccesos(): void {
    if (this.pasoGeneralesDebeSaltarse) {
      this.irAlPaso(1); // salta el paso 2 hacia atrás también
    } else {
      this.irAlPaso(2);
    }
  }

  continuarAccesos(): void {
    this.accesosForm.markAllAsTouched();
    if (this.accesosForm.invalid) return;
    this.guardarAccesosNodoActual();
    this.marcarPasoCompletado(3);
    this.guardarBorradorSilencioso();
    if (this.mostrarCuentaLiquidacion) {
      this.irAlPaso(4);
    } else if (this.mostrarPasoDocumentos) {
      this.marcarPasoCompletado(4);
      this.irAlPaso(5);
    } else {
      this.marcarPasoCompletado(4);
      this.finalizarRegistro();
    }
  }

  continuarLiquidacion(): void {
    if (this.liquidacionForm.invalid) { this.liquidacionForm.markAllAsTouched(); return; }
    this.marcarPasoCompletado(4);
    this.guardarBorradorSilencioso();
    if (this.mostrarPasoDocumentos) {
      this.irAlPaso(5);
    } else {
      this.finalizarRegistro();
    }
  }

  finalizarRegistro(): void {
    const pasoInvalido = this.primerPasoInvalido();
    if (pasoInvalido !== null) { this.pasoActual = pasoInvalido; this.registroTerminado = false; return; }
    const faltantes = this.documentosVisibles.filter(d => d.obligatorio && !d.archivo);
    this.archivosInvalidos = faltantes.length > 0;
    if (this.archivosInvalidos) { this.pasoActual = 5; return; }
    this.guardarDocumentosNodoActual();
    this.marcarNodoActualCompletado();
    if (this.mostrarArbolWizard && this.avanzarASiguienteSucursal()) {
      this.guardarBorradorSilencioso();
      return;
    }
    if (this.mostrarArbolWizard) {
      const pendiente = this.primerNodoPendienteArbol();
      if (pendiente) {
        this.seleccionarNodoArbol(pendiente);
        this.guardarBorradorSilencioso();
        return;
      }
    }
    this.marcarPasoCompletado(5);
    this.registroTerminado = true;
    this.guardarBorradorSilencioso();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private primerPasoInvalido(): PasoWizard | null {
    if (this.afiliacionForm.invalid) return 0;
    if (this.comercioForm.invalid) return 1;
    if (this.requiereArbolNegocio() && this.arbolNegocioForm.invalid) return 7;
    if (!this.pasoGeneralesDebeSaltarse && this.datosForm.invalid) return 2;
    if (this.accesosForm.invalid) return 3;
    if (this.mostrarCuentaLiquidacion && this.liquidacionForm.invalid) return 4;
    return null;
  }

  private primerNodoPendienteArbol(): NodoArbolNegocio | undefined {
    return this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => !this.nodoArbolCompletado(nodo.id));
  }

  private hayNodoSiguienteArbol(): boolean {
    const nodos = this.aplanarArbolNegocio(this.arbolNegocioWizard);
    const actualId = this.arbolNegocioForm.controls.nodoSeleccionado.value || nodos[0]?.id || 'sucursal-1';
    const actualIndex = nodos.findIndex(nodo => nodo.id === actualId);
    return actualIndex >= 0 && actualIndex < nodos.length - 1;
  }

  // ── Resumen ───────────────────────────────────────────────────────────────────
  resumenPaso(paso: number): string {
    switch (paso) {
      case 1: {
        const nivel = this.comercioForm.value.nivel;
        const tipo = this.comercioForm.value.tipoComercio;
        const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel ?? '');

        if (!nivel) return 'Descripción del comercio pendiente';
        return esSinTipo ? nivel : `${nivel} · ${tipo || 'Tipo pendiente'}`;
      }
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
    this.arbolNegocioForm.reset({ numeroEntidades: '1', numeroSucursales: '1', numeroCajas: '1', ubicacionSeleccionada: '', nivelSeleccionado: '', sucursalesPorEntidad: '', cajasPorSucursal: '', nombresArbol: '', nodosColapsados: '', nodosCompletados: '', nodoSeleccionado: '', datosPorSucursal: '', comercioPorNodo: '', accesosPorSucursal: '' });
    this.tipoNegocioSeleccionado = undefined;
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
      this.guardarCapturaNodoActual();
      localStorage.setItem(this.draftKey, JSON.stringify({
        pasoActual: this.pasoActual,
        pasosCompletados: [...this.pasosCompletados],
        registroTerminado: this.registroTerminado,
        afiliacion: this.afiliacionForm.getRawValue(),
        comercio: this.comercioForm.getRawValue(),
        arbolNegocio: this.arbolNegocioForm.getRawValue(),
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
      if (draft.arbolNegocio) this.arbolNegocioForm.patchValue(draft.arbolNegocio);
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
      this.tipoNegocioSeleccionado = this.buscarTipoNegocioDesdeComercio();
    } catch {
      try { localStorage.removeItem(this.draftKey); } catch { /* no-op */ }
    }
  }

  private requiereArbolNegocio(tipo = this.tipoNegocioSeleccionado): boolean {
    const tipoComercio = tipo?.tipoComercio ?? this.comercioForm.controls.tipoComercio.value;
    return ['Sucursales Únicas', 'Sucursales de Grupo', 'Empresa Holding', 'Empresa Grupo'].includes(tipoComercio);
  }

  private requierePantallaArbolNegocio(tipo = this.tipoNegocioSeleccionado): boolean {
    return tipo?.id !== 'comercio-unico';
  }

  private numeroEntero(valor: string, minimo: number): number {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo ? Math.floor(numero) : minimo;
  }

  private formatearNumero(numero: number): string {
    return String(numero).padStart(2, '0');
  }

  private obtenerCajasPorSucursal(): Record<string, number> {
    const sucursales = this.numeroEntero(this.arbolNegocioForm.controls.numeroSucursales.value, 1);
    const cajasBase = this.numeroEntero(this.arbolNegocioForm.controls.numeroCajas.value, 1);
    let cajas: Record<string, number> = {};

    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.cajasPorSucursal.value || '[]');
      if (Array.isArray(parsed)) {
        parsed.forEach((valor, index) => {
          cajas[String(index)] = Math.max(1, Math.floor(Number(valor) || cajasBase));
        });
      } else if (parsed && typeof parsed === 'object') {
        cajas = Object.fromEntries(
          Object.entries(parsed).map(([clave, valor]) => [clave, Math.max(1, Math.floor(Number(valor) || cajasBase))])
        );
      }
    } catch {
      cajas = {};
    }

    for (let index = 0; index < sucursales; index += 1) {
      cajas[String(index)] ??= cajasBase;
    }
    return cajas;
  }

  private sincronizarCajasPorSucursal(): void {
    this.guardarCajasPorSucursal(this.obtenerCajasPorSucursal());
  }

  private guardarCajasPorSucursal(cajas: Record<string, number>): void {
    this.arbolNegocioForm.controls.cajasPorSucursal.setValue(JSON.stringify(cajas), { emitEvent: false });
  }

  private obtenerSucursalesPorEntidad(): number[] {
    const entidades = this.numeroEntero(this.arbolNegocioForm.controls.numeroEntidades.value, 1);
    const sucursalesBase = this.numeroEntero(this.arbolNegocioForm.controls.numeroSucursales.value, 1);
    let sucursales: number[] = [];

    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.sucursalesPorEntidad.value || '[]');
      if (Array.isArray(parsed)) sucursales = parsed.map(valor => Math.max(1, Math.floor(Number(valor) || sucursalesBase)));
    } catch {
      sucursales = [];
    }

    while (sucursales.length < entidades) sucursales.push(sucursalesBase);
    return sucursales.slice(0, entidades);
  }

  private guardarSucursalesPorEntidad(sucursales: number[]): void {
    this.arbolNegocioForm.controls.sucursalesPorEntidad.setValue(JSON.stringify(sucursales), { emitEvent: false });
  }

  private crearEntidadArbol(entidadIndex: number, padreRuta = ''): NodoArbolNegocio {
    const entidadId = padreRuta ? `${padreRuta}-entidad-${entidadIndex + 1}` : `entidad-${entidadIndex + 1}`;
    const entidadNombre = this.nombreNodoArbol(entidadId, `Entidad ${this.formatearNumero(entidadIndex + 1)}`);
    const ruta = [padreRuta ? this.nombreNodoArbol(padreRuta, 'Sub Afiliado 01') : '', entidadNombre].filter(Boolean).join(' > ');
    const sucursales = this.obtenerSucursalesPorEntidad()[entidadIndex] ?? this.numeroEntero(this.arbolNegocioForm.controls.numeroSucursales.value, 1);
    return {
      id: entidadId,
      nombre: entidadNombre,
      nivel: 'entidad',
      ruta,
      hijos: Array.from({ length: sucursales }, (_, sucursalIndex) => this.crearSucursalArbol(sucursalIndex, entidadId, ruta)),
    };
  }

  private crearSucursalArbol(sucursalIndex: number, padreId = '', padreRuta = ''): NodoArbolNegocio {
    const sucursalId = padreId ? `${padreId}-sucursal-${sucursalIndex + 1}` : `sucursal-${sucursalIndex + 1}`;
    const sucursalNombre = this.nombreNodoArbol(sucursalId, `Sucursal ${this.formatearNumero(sucursalIndex + 1)}`);
    const ruta = [padreRuta, sucursalNombre].filter(Boolean).join(' > ');
    const cajasPorSucursal = this.obtenerCajasPorSucursal();
    const cajas = cajasPorSucursal[sucursalId] ?? cajasPorSucursal[String(sucursalIndex)] ?? 1;
    return {
      id: sucursalId,
      nombre: sucursalNombre,
      nivel: 'sucursal',
      ruta: ruta || sucursalNombre,
      hijos: Array.from({ length: cajas }, (_, cajaIndex) => {
        const cajaId = `${sucursalId}-caja-${cajaIndex + 1}`;
        const cajaNombre = this.nombreNodoArbol(cajaId, `Caja ${this.formatearNumero(cajaIndex + 1)}`);
        return {
          id: cajaId,
          nombre: cajaNombre,
          nivel: 'caja',
          ruta: [ruta || sucursalNombre, cajaNombre].filter(Boolean).join(' > '),
        };
      }),
    };
  }

  private aplanarArbolNegocio(nodos: NodoArbolNegocio[]): NodoArbolNegocio[] {
    return nodos.flatMap(nodo => [nodo, ...this.aplanarArbolNegocio(nodo.hijos ?? [])]);
  }

  private primerNodoCapturableArbol(): NodoArbolNegocio | undefined {
    return this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => nodo.nivel !== 'caja');
  }

  private configurarArbolPorTipo(tipo: TipoNegocio): void {
    const config = this.configuracionArbol;
    this.arbolNegocioForm.patchValue({
      numeroEntidades: String(config.entidadesBase),
      numeroSucursales: String(config.sucursalesBase),
      numeroCajas: String(config.cajasBase),
      ubicacionSeleccionada: '',
      nivelSeleccionado: '',
      nodoSeleccionado: '',
      cajasPorSucursal: '',
      sucursalesPorEntidad: '',
      nombresArbol: '',
      nodosColapsados: '',
      nodosCompletados: '',
      datosPorSucursal: '',
      comercioPorNodo: '',
      accesosPorSucursal: '',
    }, { emitEvent: false });
  }

  nodoArbolCompletado(id: string): boolean {
    return this.obtenerNodosCompletados().includes(id);
  }

  private datosNodoCompletos(id: string, tipoComercio: string): boolean {
    const camposRequeridos = (this.datosGeneralesPorTipo[tipoComercio] ?? [])
      .filter(campo => !this.camposDinamicosOpcionales.includes(campo));
    if (!camposRequeridos.length) return true;

    const datos = this.obtenerDatosPorSucursal()[id];
    if (!datos) return false;

    const camposComerciales = [
      'codigoPostalComercial',
      'tipoVialidadComercial',
      'nombreVialidadComercial',
      'coloniaComercial',
      'localidadComercial',
      'municipioComercial',
      'entidadFederativaComercial',
      'correoComercial',
      'telefonoComercial',
    ];

    return [...camposRequeridos, ...camposComerciales]
      .every(campo => `${datos[campo] || ''}`.trim().length > 0);
  }

  private accesosNodoCompletos(id: string): boolean {
    return !!this.obtenerAccesosPorSucursal()[id];
  }

  private documentosNodoCompletos(id: string, tipoComercio: string): boolean {
    const reglas = this.documentosPorTipoComercio[tipoComercio] ?? [];
    const obligatorios = reglas.filter(regla => regla.obligatorio);
    if (!obligatorios.length) return true;

    const documentos = this.documentosPorNodo[id] ?? {};
    return obligatorios.every(regla => !!documentos[regla.numero]?.archivoNombre || !!documentos[regla.numero]?.archivo);
  }

  nombreNodoArbol(id: string, respaldo: string): string {
    return this.obtenerNombresArbol()[id] || respaldo;
  }

  private obtenerNombresArbol(): Record<string, string> {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.nombresArbol.value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private obtenerNodosColapsados(): string[] {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.nodosColapsados.value || '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private obtenerNodosCompletados(): string[] {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.nodosCompletados.value || '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private marcarNodoActualCompletado(): void {
    if (!this.mostrarArbolWizard) return;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    const completados = new Set(this.obtenerNodosCompletados());
    completados.add(nodoId);
    this.arbolNegocioForm.controls.nodosCompletados.setValue(JSON.stringify([...completados]), { emitEvent: false });
  }

  private buscarNodoArbol(id: string): NodoArbolNegocio | undefined {
    if (!id) return undefined;
    return this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => nodo.id === id);
  }

  private guardarDatosSucursalActual(): void {
    if (!this.mostrarArbolWizard) return;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    const datos = this.obtenerDatosPorSucursal();
    const datosNodo = this.datosForm.getRawValue();
    datos[nodoId] = datosNodo;
    this.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(datos), { emitEvent: false });
    this.actualizarNombreSucursalDesdeDatos(nodoId, datosNodo);
  }

  private guardarCapturaNodoActual(): void {
    if (!this.mostrarArbolWizard) return;
    if (this.pasoActual === 1) this.guardarComercioNodoActual();
    if (this.pasoActual === 2) this.guardarDatosSucursalActual();
    if (this.pasoActual === 3) this.guardarAccesosNodoActual();
    if (this.pasoActual === 5) this.guardarDocumentosNodoActual();
  }

  private cargarCapturaNodo(nodoId: string): void {
    if (this.pasoActual === 2) this.cargarDatosSucursal(nodoId);
    if (this.pasoActual === 3) this.cargarAccesosNodo(nodoId);
    if (this.pasoActual === 5) this.cargarDocumentosNodo(nodoId);
  }

  private cargarCapturaNodoCompleta(nodoId: string): void {
    this.cargarDatosSucursal(nodoId);
    this.cargarAccesosNodo(nodoId);
    this.cargarDocumentosNodo(nodoId);
  }

  private cargarDatosSucursal(sucursalId: string): void {
    const datos = this.obtenerDatosPorSucursal()[sucursalId];
    this.datosForm.reset({ ...this.crearDatosGeneralesVacios(), ...(datos ?? {}) } as any, { emitEvent: false });
    if (this.mostrarInfoFiscalEntidadSucursal && !this.datosForm.controls.mismaInfoFiscalEntidad.value) {
      this.limpiarInfoFiscalEntidad();
    }
    this.actualizarValidadoresDatos();
    this.actualizarEstadoInfoFiscalEntidad();
  }

  private obtenerDatosPorSucursal(): Record<string, Record<string, string | boolean>> {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.datosPorSucursal.value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private guardarComercioNodoActual(): void {
    if (!this.mostrarArbolWizard) return;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    const comercio = this.obtenerComercioPorNodo();
    comercio[nodoId] = this.comercioForm.getRawValue();
    this.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(comercio), { emitEvent: false });
  }

  private obtenerComercioPorNodo(): Record<string, { nivel: string; tipoComercio: string; afiliacionComisionista: string }> {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.comercioPorNodo.value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private nivelClientePorNodo(nodo: NodoArbolNegocio): string {
    if (nodo.nivel === 'sub-afiliado') return 'Sub Afiliado';
    if (nodo.nivel === 'entidad') return 'Entidad';
    if (nodo.nivel === 'sucursal') return 'Sucursal';
    return 'Caja';
  }

  private copiarInfoFiscalDesdeEntidad(): void {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const entidad = nodo ? this.buscarEntidadPadre(nodo.id) : undefined;
    if (!entidad) return;

    const datosEntidad = this.obtenerDatosPorSucursal()[entidad.id];
    if (!datosEntidad) return;

    const valores = Object.fromEntries(
      this.camposInfoFiscalEntidad.map(campo => [campo, datosEntidad[campo] ?? ''])
    );
    this.datosForm.patchValue(valores as any, { emitEvent: false });
  }

  private limpiarInfoFiscalEntidad(): void {
    const valores = Object.fromEntries(
      this.camposInfoFiscalEntidad.map(campo => {
        const actual = this.datosForm.get(campo)?.value;
        return [campo, typeof actual === 'boolean' ? false : ''];
      })
    );
    this.datosForm.patchValue(valores as any, { emitEvent: false });
  }

  private buscarEntidadPadre(nodoId: string): NodoArbolNegocio | undefined {
    const match = nodoId.match(/^(.*entidad-\d+)/);
    return match ? this.buscarNodoArbol(match[1]) : undefined;
  }

  private actualizarEstadoInfoFiscalEntidad(): void {
    const debeBloquear = this.mostrarInfoFiscalEntidadSucursal && this.datosForm.controls.mismaInfoFiscalEntidad.value;
    this.camposInfoFiscalEntidad.forEach(campo => {
      const control = this.datosForm.get(campo);
      if (!control) return;
      if (debeBloquear) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });
  }

  private guardarAccesosNodoActual(): void {
    if (!this.mostrarArbolWizard) return;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    const accesos = this.obtenerAccesosPorSucursal();
    accesos[nodoId] = this.accesosForm.getRawValue();
    this.arbolNegocioForm.controls.accesosPorSucursal.setValue(JSON.stringify(accesos), { emitEvent: false });
  }

  private cargarAccesosNodo(nodoId: string): void {
    const accesos = this.obtenerAccesosPorSucursal()[nodoId];
    this.accesosForm.reset((accesos ?? {
      modoReserva: 'NINGUNO',
      cajasTPV: '1',
      tieneSupervisor: 'si',
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
      pinAdministrador: '',
      pinCorreo: '',
      pinConfirmarCorreo: '',
      pinContrasena: '',
    }) as any, { emitEvent: false });
    this.actualizarValidadoresAccesos(this.accesosForm.controls.modoReserva.value as ModoReserva);
  }

  private obtenerAccesosPorSucursal(): Record<string, Record<string, string | boolean>> {
    try {
      const parsed = JSON.parse(this.arbolNegocioForm.controls.accesosPorSucursal.value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private guardarDocumentosNodoActual(): void {
    if (!this.mostrarArbolWizard) return;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    this.documentosPorNodo[nodoId] = Object.fromEntries(
      this.documentos.map(documento => [documento.numero, {
        archivo: documento.archivo,
        archivoNombre: documento.archivoNombre,
      }])
    );
  }

  private cargarDocumentosNodo(nodoId: string): void {
    const documentos = this.documentosPorNodo[nodoId] ?? {};
    this.documentos.forEach(documento => {
      const guardado = documentos[documento.numero];
      documento.archivo = guardado?.archivo;
      documento.archivoNombre = guardado?.archivoNombre;
    });
    this.archivosInvalidos = false;
  }

  private avanzarASiguienteSucursal(): boolean {
    const nodos = this.aplanarArbolNegocio(this.arbolNegocioWizard);
    const actualId = this.arbolNegocioForm.controls.nodoSeleccionado.value || nodos[0]?.id || 'sucursal-1';
    const actualIndex = nodos.findIndex(nodo => nodo.id === actualId);
    const siguiente = nodos[actualIndex + 1];
    if (!siguiente) return false;

    this.arbolNegocioForm.patchValue({
      ubicacionSeleccionada: siguiente.ruta,
      nivelSeleccionado: siguiente.nivel,
      nodoSeleccionado: siguiente.id,
    }, { emitEvent: false });
    this.cargarDatosSucursal(siguiente.id);
    this.cargarAccesosNodo(siguiente.id);
    this.cargarDocumentosNodo(siguiente.id);
    this.aplicarComercioPorNodo(siguiente);
    this.pasosCompletados.delete(1);
    this.pasosCompletados.delete(2);
    this.pasosCompletados.delete(3);
    this.pasosCompletados.delete(5);
    return true;
  }

  private actualizarNombreSucursalDesdeDatos(sucursalId: string, datosSucursal: Record<string, string | boolean>): void {
    const nodo = this.buscarNodoArbol(sucursalId);
    if (!nodo) return;

    const municipio = `${datosSucursal['municipioComercial'] || ''}`.trim();
    const localidad = `${datosSucursal['localidadComercial'] || ''}`.trim();
    const colonia = `${datosSucursal['coloniaComercial'] || ''}`.trim();
    const nombreComercial = `${datosSucursal['nombreComercial'] || datosSucursal['razonSocial'] || ''}`.trim();
    let nombre = '';

    if (nodo.nivel === 'sub-afiliado') {
      nombre = ['Sub Afiliado', municipio].filter(Boolean).join(' ');
    } else if (nodo.nivel === 'entidad') {
      nombre = ['Entidad', nombreComercial, localidad].filter(Boolean).join(' ');
    } else if (nodo.nivel === 'sucursal') {
      const sufijo = this.municipioRepetidoEnSucursales(nodo.id, municipio) ? colonia : municipio;
      nombre = ['Sucursal', sufijo || municipio || colonia].filter(Boolean).join(' ');
    }

    if (!nombre) return;
    const nombres = this.obtenerNombresArbol();
    nombres[sucursalId] = nombre;
    this.arbolNegocioForm.controls.nombresArbol.setValue(JSON.stringify(nombres), { emitEvent: false });
  }

  private municipioRepetidoEnSucursales(sucursalId: string, municipio: string): boolean {
    if (!municipio) return false;
    const datos = this.obtenerDatosPorSucursal();
    const parentId = sucursalId.includes('-sucursal-') ? sucursalId.replace(/-sucursal-\d+$/, '') : '';
    return this.aplanarArbolNegocio(this.arbolNegocioWizard).some(nodo => {
      if (nodo.id === sucursalId || nodo.nivel !== 'sucursal') return false;
      if (parentId && !nodo.id.startsWith(`${parentId}-sucursal-`)) return false;
      const datosNodo = datos[nodo.id];
      const municipioNodo = `${datosNodo?.['municipioComercial'] || ''}`.trim();
      return municipioNodo.toLowerCase() === municipio.toLowerCase();
    });
  }

  private formatearRutaNodoDesdeDatos(nodoId: string): string {
    const datosSucursal = this.obtenerDatosPorSucursal()[nodoId];
    const nodoSeleccionado = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const nombreComercial = `${datosSucursal?.['nombreComercial'] || datosSucursal?.['razonSocial'] || ''}`.trim();
    const ruta = nodoSeleccionado?.ruta || this.buscarNodoArbol(nodoId)?.ruta || '';
    return [ruta, nombreComercial].filter(Boolean).join(' > ');
  }

  private crearDatosGeneralesVacios(): Record<string, string | boolean> {
    return Object.fromEntries(
      Object.entries(this.datosForm.getRawValue()).map(([campo, valor]) => [campo, typeof valor === 'boolean' ? false : ''])
    );
  }

  private buscarTipoNegocioDesdeComercio(): TipoNegocio | undefined {
    const { nivel, tipoComercio } = this.comercioForm.getRawValue();
    return [
      {
        id: 'comercio-unico',
        titulo: 'Comercio único',
        descripcion: '',
        icono: '',
        imagen: 'assets/paquetes/comercio.png',
        iconoInferior: '',
        imagenInferior: 'assets/paquetes/usuario.png',
        nivel: 'Sucursal',
        tipoComercio: 'Sucursales Únicas',
        beneficios: [],
      },
      {
        id: 'sucursales-multiples',
        titulo: 'Sucursales múltiples',
        descripcion: '',
        icono: '',
        imagen: 'assets/paquetes/sucursales.png',
        iconoInferior: '',
        imagenInferior: 'assets/paquetes/grupo.png',
        nivel: 'Sucursal',
        tipoComercio: 'Sucursales de Grupo',
        beneficios: [],
      },
      {
        id: 'empresa-holding',
        titulo: 'Empresa holding',
        descripcion: '',
        icono: '',
        imagen: 'assets/paquetes/empresa.png',
        iconoInferior: '',
        imagenInferior: 'assets/paquetes/corona.png',
        nivel: 'Sub Afiliado',
        tipoComercio: 'Empresa Holding',
        beneficios: [],
      },
      {
        id: 'auditor-unico',
        titulo: 'Sucursales múltiples un solo auditor',
        descripcion: '',
        icono: '',
        imagen: 'assets/paquetes/auditor.png',
        iconoInferior: '',
        imagenInferior: 'assets/paquetes/seguridad.png',
        nivel: 'Entidad',
        tipoComercio: 'Empresa Grupo',
        beneficios: [],
      },
    ].find(tipo => tipo.nivel === nivel && tipo.tipoComercio === tipoComercio);
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

  private clabeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim();
      if (!valor) return null;
      if (!/^\d{18}$/.test(valor)) return { clabeInvalida: true };
      const pesos = [3, 7, 1];
      const suma = valor
        .slice(0, 17)
        .split('')
        .reduce((total, digito, index) => total + (Number(digito) * pesos[index % 3]) % 10, 0);
      const verificador = (10 - (suma % 10)) % 10;
      return verificador === Number(valor[17]) ? null : { clabeInvalida: true };
    };
  }

  private numeroCuentaValidator(longitud: number, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim();
      if (!valor) return null;
      return new RegExp(`^\\d{${longitud}}$`).test(valor) ? null : { [errorKey]: true };
    };
  }

  private actualizarValidadorCuentaLiquidacion(tipoCuenta: string): void {
    const cuenta = this.liquidacionForm.controls.cuentaClabe;
    const longitudEsperada = tipoCuenta === 'Tarjeta' ? 16 : 18;
    const validadores = tipoCuenta === 'Tarjeta'
      ? [Validators.required, this.numeroCuentaValidator(16, 'tarjetaInvalida')]
      : [Validators.required, this.numeroCuentaValidator(18, 'clabeInvalida')];
    const valor = `${cuenta.value ?? ''}`.trim();

    if (valor && valor.length > longitudEsperada) {
      cuenta.setValue(valor.slice(0, longitudEsperada), { emitEvent: false });
    }

    cuenta.setValidators(validadores);
    cuenta.updateValueAndValidity({ emitEvent: false });
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
    this.togglarControl(this.accesosForm.controls.adminNombre, true, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminPaterno, true, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminMaterno, true, [Validators.required]);
    this.togglarControl(this.accesosForm.controls.adminCorreo, true, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.adminConfirmarCorreo, true, [Validators.required, Validators.email]);
    this.togglarControl(this.accesosForm.controls.adminTelefono, true, [Validators.required, Validators.pattern(/^\d{10}$/)]);

    this.togglarControl(this.accesosForm.controls.perfilReservaNombre, false);
    this.togglarControl(this.accesosForm.controls.perfilReservaPaterno, false);
    this.togglarControl(this.accesosForm.controls.perfilReservaMaterno, false);
    this.togglarControl(this.accesosForm.controls.perfilReservaCorreo, false);
    this.togglarControl(this.accesosForm.controls.perfilReservaConfirmarCorreo, false);
    this.togglarControl(this.accesosForm.controls.perfilReservaTelefono, false);
    this.togglarControl(this.accesosForm.controls.reservaSplit, false);
    this.togglarControl(this.accesosForm.controls.pinAdministrador, false);
    this.togglarControl(this.accesosForm.controls.pinCorreo, false);
    this.togglarControl(this.accesosForm.controls.pinConfirmarCorreo, false);
    this.togglarControl(this.accesosForm.controls.pinContrasena, false);
    this.accesosForm.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarEstadoLiquidacion(igualComercio: boolean): void {
    this.datosBeneficiarioIgualComercio = igualComercio;

    if (igualComercio) {
      this.sincronizarBeneficiarioDesdeComercio();
      this.controlesBeneficiario().forEach(control => control.disable({ emitEvent: false }));
    } else {
      this.controlesBeneficiario().forEach(control => control.enable({ emitEvent: false }));
      this.limpiarBeneficiario();
    }

    this.actualizarValidadoresBeneficiario(this.liquidacionForm.controls.tipoPersonaBeneficiario.value as TipoPersonaBeneficiario);
    this.liquidacionForm.updateValueAndValidity({ emitEvent: false });
  }

  private controlesBeneficiario(): AbstractControl[] {
    return [
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
  }

  private limpiarBeneficiario(): void {
    this.tipoPersonaBeneficiario = 'fisica';
    this.liquidacionForm.patchValue({
      tipoPersonaBeneficiario: 'fisica',
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

  private actualizarValidadoresBeneficiario(tipo: TipoPersonaBeneficiario): void {
    const apellidosRequeridos = tipo === 'fisica' && !this.datosBeneficiarioIgualComercio;
    this.setValidators(this.liquidacionForm.controls.nombreBeneficiario, [Validators.required]);
    this.setValidators(this.liquidacionForm.controls.apellidoPaternoBeneficiario, apellidosRequeridos ? [Validators.required] : []);
    this.setValidators(this.liquidacionForm.controls.apellidoMaternoBeneficiario, apellidosRequeridos ? [Validators.required] : []);
    if (tipo !== 'fisica' && !this.datosBeneficiarioIgualComercio) {
      this.liquidacionForm.patchValue({
        apellidoPaternoBeneficiario: '',
        apellidoMaternoBeneficiario: '',
      }, { emitEvent: false });
    }
  }

  private actualizarBancoDesdeClabe(clabe: string): void {
    if (this.liquidacionForm.controls.tipoCuenta.value === 'Tarjeta') return;
    const valor = `${clabe ?? ''}`.trim();
    if (!/^\d{18}$/.test(valor)) return;
    const banco = this.bancosPorClaveClabe[valor.slice(0, 3)];
    if (!banco) return;
    this.liquidacionForm.patchValue({ nombreBanco: banco }, { emitEvent: false });
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const d = this.datosForm.getRawValue();
    const tipo = this.tipoPersonaBeneficiarioDesdeRol();
    this.tipoPersonaBeneficiario = tipo;
    const direccion = d.direccionComercial || [
      d.tipoVialidadComercial,
      d.nombreVialidadComercial,
      d.numeroExteriorComercial,
      d.numeroInteriorComercial,
      d.coloniaComercial,
      d.localidadComercial,
      d.municipioComercial,
      d.entidadFederativaComercial,
    ].filter(Boolean).join(', ') || [d.ciudad, d.departamento].filter(Boolean).join(', ');
    this.liquidacionForm.patchValue({
      tipoPersonaBeneficiario: tipo,
      nombreBeneficiario: tipo === 'fisica' ? d.nombre || '' : d.razonSocial || d.nombreComercial || '',
      apellidoPaternoBeneficiario: tipo === 'fisica' ? d.apellidoPaterno || '' : '',
      apellidoMaternoBeneficiario: tipo === 'fisica' ? d.apellidoMaterno || '' : '',
      correoBeneficiario: d.correoComercial || d.correo || '',
      direccionBeneficiario: direccion,
      rfcBeneficiario: d.rfc || '',
      actividadBeneficiario: d.actividad || d.descripcionGiro || '',
      giroBeneficiario: d.giroComercial || d.descripcionGiro || '',
    }, { emitEvent: false });
    this.actualizarValidadoresBeneficiario(tipo);
  }

  private tipoPersonaBeneficiarioDesdeRol(): TipoPersonaBeneficiario {
    const { nivel, tipoComercio } = this.comercioForm.getRawValue();
    const rol = ['Referenciador', 'Comisionista'].includes(nivel) ? nivel : tipoComercio;
    const rolesPersonaFisica = ['Persona Física', 'Sucursal Persona Física', 'Referenciador', 'Comisionista'];
    return rolesPersonaFisica.includes(rol) ? 'fisica' : 'moral';
  }
}
