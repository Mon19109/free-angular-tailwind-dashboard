import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ThemeToggleButtonComponent } from '../../shared/components/common/theme-toggle/theme-toggle-button.component';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { CodigoPostalLocalizacion, LocalidadesService } from '../../services/localidades.service';
import { PreregistroCompletoService } from '../../services/preregistro-completo.service';
import { DocumentoPreregistroUpload, PreregistroDocumentosService } from '../../services/preregistro-documentos.service';
import { PreRegistroService, TipoComercioCatalogo } from '../../services/preregistro.service';
import { ValidarAfiliacionService } from '../../services/validar-afiliacion.service';
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
type ObjetoRespuestaPreregistro = Record<string, unknown>;
type PayloadPreRegistro = Record<string, unknown>;

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
  comercio: { nivel: string; tipoComercio: string; tipoComercioId?: number; afiliacionComisionista: string };
  arbolNegocio: { numeroEntidades: string; numeroSucursales: string; numeroCajas: string; ubicacionSeleccionada: string; nivelSeleccionado: string; sucursalesPorEntidad: string; cajasPorSucursal: string; nombresArbol: string; nodosColapsados: string; nodosCompletados: string; nodoSeleccionado: string; datosPorSucursal: string; comercioPorNodo: string };
  comisionista: Record<string, string>;
  datos: Record<string, string | boolean>;
  accesos: Record<string, string | boolean>;
  liquidacion: Record<string, string | boolean>;
  documentos: Array<{ numero: number; archivoNombre?: string }>;
  payload?: unknown;
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly regimenFiscalService = inject(RegimenFiscalService);
  private readonly localidadesService = inject(LocalidadesService);
  private readonly preregistroCompletoService = inject(PreregistroCompletoService);
  private readonly preregistroDocumentosService = inject(PreregistroDocumentosService);
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly validarAfiliacionService = inject(ValidarAfiliacionService);
  private readonly draftKey = 'kashpay.preregistro.draft.v1';
  private readonly payloadKey = 'kashpay.preregistro.payload.v1';

  // ── Estado UI ────────────────────────────────────────────────────────────────
  pasoActual: PasoWizard = 0;
  pasosCompletados = new Set<number>();
  mostrarAyuda = false;
  mostrarComisionista = false;
  registroTerminado = false;
  archivosInvalidos = false;
  borradorGuardado = false;
  errorEnvioPreRegistro = '';
  validandoAfiliacion = false;
  errorAfiliacion = '';
  tipoPersonaBeneficiario: TipoPersonaBeneficiario = 'fisica';
  datosBeneficiarioIgualComercio = false;
  modoReservaActual: ModoReserva = 'NINGUNO';
  tiposComercio: string[] = [];
  tipoNegocioSeleccionado?: TipoNegocio;
  private typeOfBusinessPorTipoComercio: Record<string, number> = {};
  private tiposComercioCatalogoPorNivel: Record<string, Array<{ id: number; nombre: string }>> = {};
  private tiposComercioCatalogoSolicitados = new Set<string>();
  localidadesFiscal: CodigoPostalLocalizacion[] = [];
  localidadesComercial: CodigoPostalLocalizacion[] = [];
  localidadesRepresentante: CodigoPostalLocalizacion[] = [];
  cargandoLocalidadesFiscal = false;
  cargandoLocalidadesComercial = false;
  cargandoLocalidadesRepresentante = false;
  private documentosPorNodo: Record<string, Record<number, DocumentoNodo>> = {};
  private contextoComercio: 'paquete' | 'caja' = 'paquete';
  private readonly sufijosDocumentos: Record<number, { sufijo: string; extension: 'pdf' | 'png' }> = {
    1: { sufijo: 'COMP_DOM', extension: 'pdf' },
    2: { sufijo: 'ACTA_CONST', extension: 'pdf' },
    3: { sufijo: 'INE', extension: 'pdf' },
    4: { sufijo: 'CONTRATO', extension: 'pdf' },
    5: { sufijo: 'IMGE', extension: 'png' },
    6: { sufijo: 'IMGI', extension: 'png' },
    7: { sufijo: 'IMGI2', extension: 'png' },
    8: { sufijo: 'ESCRI', extension: 'pdf' },
    9: { sufijo: 'PODER', extension: 'pdf' },
    10: { sufijo: 'CONS', extension: 'pdf' },
    11: { sufijo: 'EFIRMA', extension: 'pdf' },
    12: { sufijo: 'INERL', extension: 'pdf' },
    13: { sufijo: 'INETER', extension: 'pdf' },
    14: { sufijo: 'CARATULA_EDO_CTA', extension: 'pdf' },
  };


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
  readonly tiposPersona = ['PF', 'PM'];
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
  regimenesFiscales: string[] = [];
  readonly girosComerciales: string[] = [];
  readonly tiposComercioPorNivel: Record<string, string[]> = {
    'Sub Afiliado': ['Empresa Holding'],
    'Entidad': ['Empresa Grupo', 'Persona Física'],
    'Sucursal': ['Sucursales de Grupo', 'Sucursal Persona Física', 'Sucursales Únicas'],
    'Caja': ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'],
    'Referenciador': [], 'Promotor': [], 'Comisionista': [],
  };

  readonly datosGeneralesPorTipo: Record<string, string[]> = {
    'Empresa Grupo': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Empresa Agrupadora': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Entidad Agrupadora': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Persona Física': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Empresa Holding': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales de Grupo': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursal Persona Física': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Sucursales Únicas': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Caja con Tarjeta sólo Fondeo': [], 'Caja con Tarjeta SPEI': [],
    'Cuenta Entidad': [], 'Cuenta Terminal': [], 'Cuenta Terminal Pin Rapido': [],
    'Referenciador': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],
    'Comisionista': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle'],

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
    'Empresa Agrupadora': [
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
    'Entidad Agrupadora': [
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
      { numero: 5, obligatorio: true },
      { numero: 6, obligatorio: true },
      { numero: 7, obligatorio: true },
      { numero: 10, obligatorio: true },
      { numero: 11, obligatorio: false },
    ],
    'Sucursal Persona Física': [
      { numero: 1, obligatorio: true },
      { numero: 3, obligatorio: true },
      { numero: 4, obligatorio: false },
      { numero: 5, obligatorio: true },
      { numero: 6, obligatorio: true },
      { numero: 7, obligatorio: true },
      { numero: 10, obligatorio: true },
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
    'Caja con Tarjeta sólo Fondeo': [],
    'Caja con Tarjeta SPEI': [],
    'Cuenta Entidad': [],
    'Cuenta Terminal': [],
    'Cuenta Terminal Pin Rapido': [],
  };

  // ── Formularios ──────────────────────────────────────────────────────────────
  readonly afiliacionForm = this.fb.nonNullable.group({
    afiliacion: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    tipoComercioId: [0],
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

  private readonly emailValidator = Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

  readonly datosForm = this.fb.nonNullable.group({
    razonSocial: [''], nombreComercial: [''], rfc: [''],
    regimenFiscal: [''], giroComercial: [''], descripcionGiro: [''], mcc: [''],
    mismaInfoFiscalEntidad: [false],
    mismaInfoAcceso: [false],
    mismaInfoAccesoRepresentante: [false],
    nombreAcceso: [''], apellidoPaternoAcceso: [''], apellidoMaternoAcceso: [''],
    nombre: [''], apellidoPaterno: [''], apellidoMaterno: [''], curp: [''], actividad: [''], actividadId: [''],
    tipoPersona: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email, this.emailValidator]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    departamento: ['', Validators.required],
    ciudad: ['', Validators.required],
    direccionComercial: ['', Validators.required],
    codigoPostal: [''], tipoVialidad: [''], nombreVialidad: [''],
    numeroExterior: [''], numeroInterior: [''], colonia: [''],
    localidad: [''], municipio: [''], entidadFederativa: [''],
    locationID: [''],
    entreCalle: [''], yCalle: [''],
    nombreRepresentante: [''], apellidoPaternoRepresentante: [''], apellidoMaternoRepresentante: [''],
    calleRepresentante: [''], numeroExteriorRepresentante: [''], numeroInteriorRepresentante: [''],
    codigoPostalRepresentante: [''], coloniaRepresentante: [''],
    municipioRepresentante: [''], estadoRepresentante: [''], locationIDRepresentante: [''],
    correoRepresentante: [''], telefonoRepresentante: [''], telefonoAdicionalRepresentante: [''],

    mismoDomicilio: [false],




    codigoPostalComercial: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5), Validators.pattern(/^\d{5}$/)]],
    tipoVialidadComercial: ['', Validators.required],
    nombreVialidadComercial: ['', Validators.required],
    numeroExteriorComercial: ['', Validators.required],
    numeroInteriorComercial: [''],
    coloniaComercial: ['', Validators.required],
    localidadComercial: ['', Validators.required],
    municipioComercial: ['', Validators.required],
    entidadFederativaComercial: ['', Validators.required],
    locationIDComercial: [''],
    entreCalleComercial: ['', Validators.required],
    yCalleComercial: ['', Validators.required],

    correoComercial: ['', [Validators.required, Validators.email]],
    nombreContactoComercial: [''],
    apellidoPaternoContactoComercial: [''],
    apellidoMaternoContactoComercial: [''],
    telefonoComercial: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10), Validators.pattern(/^\d{10}$/)]],
    telefonoAdicionalComercial: ['', [Validators.minLength(10), Validators.maxLength(10), Validators.pattern(/^\d{10}$/)]],



  });

  private readonly camposDinamicosOpcionales = ['numeroExterior', 'numeroInterior'];
  private readonly camposInfoFiscalEntidad = [
    'razonSocial', 'rfc', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc',
    'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'actividadId', 'nombreComercial',
    'tipoPersona',
    'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior',
    'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle',
  ];
  private readonly camposInfoFiscalCompartidaPersona = [
    'regimenFiscal', 'nombreComercial',
    'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior',
    'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle',
  ];
  private readonly todosCamposDinamicos: string[] = Array.from(
    new Set(Object.values(this.datosGeneralesPorTipo).flat())
  );



  private readonly tiposConRepresentante = ['Empresa Holding', 'Empresa Grupo', 'Empresa Agrupadora', 'Entidad Agrupadora', 'Sucursales de Grupo', 'Sucursales Únicas'];
  private readonly tiposSinRepresentante = ['Persona Física', 'Sucursal Persona Física', 'Referenciador', 'Comisionista'];
  private readonly tiposCaja = ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'];
  private readonly camposNombreRepresentante = ['nombreRepresentante', 'apellidoPaternoRepresentante', 'apellidoMaternoRepresentante'];
  private readonly camposNombreRepresentanteObligatorios = ['apellidoPaternoRepresentante', 'apellidoMaternoRepresentante'];
  private readonly camposDireccionRepresentante = ['calleRepresentante', 'numeroExteriorRepresentante', 'numeroInteriorRepresentante', 'codigoPostalRepresentante', 'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante', 'locationIDRepresentante'];
  private readonly camposDireccionRepresentanteObligatorios = ['calleRepresentante', 'codigoPostalRepresentante', 'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante'];
  private readonly nivelContactoAccesoPorPaquete: Record<string, string> = {
    'comercio-unico': 'Sucursal',
    'sucursales-multiples': 'Entidad',
    'empresa-holding': 'Sub Afiliado',
    'auditor-unico': 'Entidad',
  };

  private get mostrarRepresentante(): boolean {
    return this.requiereDatosRepresentante(this.tipoComercioEfectivoActual(), this.datosForm.controls.tipoPersona.value);
  }

  private get mostrarNombreRepresentante(): boolean {
    return this.mostrarRepresentante && this.datosForm.controls.tipoPersona.value !== 'PF';
  }

  private get mostrarDireccionRepresentante(): boolean {
    return this.mostrarRepresentante;
  }

  private actualizarValidadoresDatos(): void {
    const activos = new Set(this.camposDatosGenerales);
    this.todosCamposDinamicos.forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      const debeSerObligatorio = activos.has(nombre) && !this.camposDinamicosOpcionales.includes(nombre);
      control.setValidators(this.validadoresDatosPorCampo(nombre, debeSerObligatorio));
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

      const esContactoDescripcion = this.mostrarContactoAccesoDescripcion
        && ['correo', 'telefono'].includes(nombre);
      const obligatorio = this.camposDatosGenerales.includes(nombre) || esContactoDescripcion;

      control.setValidators(this.validadoresDatosPorCampo(nombre, obligatorio));

      control.updateValueAndValidity({ emitEvent: false });

    });

    ['nombreAcceso', 'apellidoPaternoAcceso', 'apellidoMaternoAcceso'].forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      control.clearValidators();
      control.updateValueAndValidity({ emitEvent: false });
    });












    const mostrarRep = this.mostrarRepresentante;
    const mostrarDirRep = this.mostrarDireccionRepresentante;
    const mostrarNombreRep = this.mostrarNombreRepresentante;

    this.camposNombreRepresentante.forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      const obligatorio = mostrarNombreRep && this.camposNombreRepresentanteObligatorios.includes(nombre);
      control.setValidators(this.validadoresDatosPorCampo(nombre, obligatorio));
      if (!mostrarNombreRep) control.setValue('', { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });

    this.camposDireccionRepresentanteObligatorios.forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      control.setValidators(this.validadoresDatosPorCampo(nombre, mostrarDirRep));
      control.updateValueAndValidity({ emitEvent: false });
    });

    if (!mostrarDirRep) {
      this.camposDireccionRepresentante.forEach(nombre => {
        const control = this.datosForm.get(nombre);
        if (!control) return;
        control.setValue('', { emitEvent: false });
        control.updateValueAndValidity({ emitEvent: false });
      });
      this.localidadesRepresentante = [];
      this.cargandoLocalidadesRepresentante = false;
    }

    const correoRep = this.datosForm.get('correoRepresentante');
    correoRep?.setValidators([Validators.email, this.emailValidator]);
    correoRep?.updateValueAndValidity({ emitEvent: false });

    const telRep = this.datosForm.get('telefonoRepresentante');
    telRep?.setValidators(this.validadoresDatosPorCampo('telefonoRepresentante', false));
    telRep?.updateValueAndValidity({ emitEvent: false });

    this.actualizarValidadoresActividadYGiro();

    if (this.pasoGeneralesDebeSaltarse && this.liquidacionForm.controls.beneficiarioIgualComercio.value) {
      this.liquidacionForm.controls.beneficiarioIgualComercio.setValue(false, { emitEvent: false });
      this.actualizarEstadoLiquidacion(false);
    }

  }

  private actualizarValidadoresActividadYGiro(): void {
    const tipoPersona = this.datosForm.controls.tipoPersona.value;
    const esPersonaFisica = tipoPersona === 'PF';
    const esPersonaMoral = tipoPersona === 'PM';

    ['giroComercial', 'descripcionGiro', 'mcc'].forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      const obligatorio = esPersonaMoral && this.camposDatosGenerales.includes(nombre);
      control.setValidators(this.validadoresDatosPorCampo(nombre, obligatorio));
      if (!esPersonaMoral) control.setValue('', { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });

    const actividad = this.datosForm.controls.actividad;
    const actividadId = this.datosForm.controls.actividadId;
    const actividadObligatoria = esPersonaFisica && this.camposDatosGenerales.includes('actividad');
    actividad.setValidators(actividadObligatoria ? [Validators.required] : []);
    actividadId.setValidators(actividadObligatoria ? [Validators.required] : []);
    if (!esPersonaFisica) {
      actividad.setValue('', { emitEvent: false });
      actividadId.setValue('', { emitEvent: false });
    }
    actividad.updateValueAndValidity({ emitEvent: false });
    actividadId.updateValueAndValidity({ emitEvent: false });

    ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp'].forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;
      const obligatorio = esPersonaFisica && this.camposDatosGenerales.includes(nombre);
      control.setValidators(this.validadoresDatosPorCampo(nombre, obligatorio));
      if (!esPersonaFisica) control.setValue('', { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });

    const razonSocial = this.datosForm.controls.razonSocial;
    const razonSocialObligatoria = esPersonaMoral && this.camposDatosGenerales.includes('razonSocial');
    razonSocial.setValidators(this.validadoresDatosPorCampo('razonSocial', razonSocialObligatoria));
    if (!esPersonaMoral) razonSocial.setValue('', { emitEvent: false });
    razonSocial.updateValueAndValidity({ emitEvent: false });
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
    cuentaFueraRed: ['no', Validators.required],
    digitoVerificador: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5), Validators.pattern(/^\d{5}$/)]],
    tipoPersonaBeneficiario: ['fisica' as TipoPersonaBeneficiario, Validators.required],
    beneficiarioIgualComercio: [false],
    nombreBeneficiario: ['', Validators.required], apellidoPaternoBeneficiario: ['', Validators.required],
    apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]],
    direccionBeneficiario: ['', Validators.required], rfcBeneficiario: ['', [Validators.required, Validators.maxLength(13), this.rfcValidator()]],
    actividadBeneficiario: ['', Validators.required], giroBeneficiario: ['', Validators.required],
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', Validators.required],
    nombreBanco: ['', Validators.required], direccionBanco: ['', Validators.required],
    telefonoBanco: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10), Validators.pattern(/^\d{10}$/)]],
    emailBanco: ['', [Validators.required, Validators.email]],
  });

  readonly comisionistaForm = this.fb.nonNullable.group({
    tipo: ['existente' as TipoComisionista, Validators.required],
    afiliacion: [''], correo: [''], confirmarCorreo: [''],
    telefono: ['', [Validators.minLength(10), Validators.maxLength(10), Validators.pattern(/^\d{10}$/)]],
    nombre: [''], paterno: [''], materno: [''],
    rfc: ['', [Validators.maxLength(13), this.rfcValidator()]],
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

    this.datosForm.controls.tipoPersona.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarValidadoresDatos());

    this.datosForm.controls.codigoPostal.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'DF'));

    this.datosForm.controls.codigoPostalComercial.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'DC'));

    this.datosForm.controls.codigoPostalRepresentante.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'REP'));

    this.datosForm.get('mismoDomicilio')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(valor => {

        if (valor) {
          this.copiarDomicilioFiscal();
        } else {
          this.limpiarDomicilioComercial();
        }

      });

    this.comercioForm.controls.nivel.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(nivel => {
        this.tiposComercio = this.filtrarTiposComercioPorPaquete(nivel, this.tiposComercioPorNivel[nivel] ?? []);
        this.cargarTiposComercioCatalogo(nivel);
        const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);
        const tipoAutomatico = this.tiposComercio.length === 1 ? this.tiposComercio[0] : '';

        if (esSinTipo) {
          this.comercioForm.controls.tipoComercio.clearValidators();
          this.comercioForm.controls.tipoComercio.setValue('', { emitEvent: false });
        } else {
          this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
          if (tipoAutomatico) {
            this.comercioForm.controls.tipoComercio.setValue(tipoAutomatico, { emitEvent: false });
          }
        }
        this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
        this.actualizarValidadoresDatos();
      });

    this.comercioForm.controls.tipoComercio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tipoComercio => {
        this.comercioForm.controls.tipoComercioId.setValue(this.typeOfBusinessPorTipoComercio[tipoComercio] ?? 0, { emitEvent: false });
        this.aplicarTipoPersonaPorTipoComercio(tipoComercio);
        this.actualizarValidadoresDatos();
      }); // 👈 antes no hacía nada

    //this.cargarBorrador();
    try { localStorage.removeItem(this.draftKey); } catch { /* no-op */ }
    this.tiposComercio = this.filtrarTiposComercioPorPaquete(
      this.comercioForm.controls.nivel.value,
      this.tiposComercioPorNivel[this.comercioForm.controls.nivel.value] ?? []
    );
    this.cargarRegimenesFiscales();
    this.actualizarValidadoresDatos();
    this.actualizarValidadorCuentaLiquidacion(this.liquidacionForm.controls.tipoCuenta.value);


  }

  private cargarRegimenesFiscales(): void {
    this.regimenFiscalService.getAllOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: regimenes => {
          this.regimenesFiscales = regimenes;
        },
        error: error => {
        void error;
          this.regimenesFiscales = [];
        }
      });
  }

  private cargarTiposComercioCatalogo(nivel: string): void {
    const idAffiliationType = this.idAffiliationTypePorNivel(nivel);
    if (!idAffiliationType) return;

    const cacheado = this.tiposComercioCatalogoPorNivel[nivel];
    if (cacheado) {
      this.aplicarTiposComercioCatalogo(nivel, cacheado);
      return;
    }

    if (this.tiposComercioCatalogoSolicitados.has(nivel)) return;
    this.tiposComercioCatalogoSolicitados.add(nivel);

    this.preRegistroService.getTiposComercio(idAffiliationType)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          console.info('[PreRegistro] catTypeOfBusinesses', { nivel, idAffiliationType, response });
          const tipos = this.extraerTiposComercioCatalogo(response);
          if (!tipos.length) return;
          this.tiposComercioCatalogoPorNivel[nivel] = tipos;
          this.aplicarTiposComercioCatalogo(nivel, tipos);
        },
        error: error => {
          void error;
          this.tiposComercioCatalogoSolicitados.delete(nivel);
        },
      });
  }

  private aplicarTiposComercioCatalogo(nivel: string, tipos: Array<{ id: number; nombre: string }>): void {
    this.typeOfBusinessPorTipoComercio = {
      ...this.typeOfBusinessPorTipoComercio,
      ...Object.fromEntries(tipos.map(tipo => [tipo.nombre, tipo.id])),
    };
    const tiposFiltrados = this.filtrarTiposComercioPorPaquete(
      nivel,
      tipos.map(tipo => tipo.nombre)
    );
    const esNivelActual = this.comercioForm.controls.nivel.value === nivel;
    if (esNivelActual) this.tiposComercio = tiposFiltrados;

    const tipoActual = this.comercioForm.controls.tipoComercio.value;
    if (!esNivelActual) {
      this.actualizarTipoComercioIdsGuardados(tipos);
      return;
    }

    if (tipoActual && !tiposFiltrados.includes(tipoActual)) {
      this.comercioForm.controls.tipoComercio.setValue('', { emitEvent: false });
      this.comercioForm.controls.tipoComercioId.setValue(0, { emitEvent: false });
    } else if (tipoActual) {
      this.comercioForm.controls.tipoComercioId.setValue(this.typeOfBusinessPorTipoComercio[tipoActual] ?? 0, { emitEvent: false });
    }
    this.actualizarTipoComercioIdsGuardados(tipos);
  }

  private idAffiliationTypePorNivel(nivel: string): number {
    const mapa: Record<string, number> = {
      'Sub Afiliado': 3,
      'Entidad': 4,
      'Sucursal': 5,
      'Caja': 6,
    };
    return mapa[nivel] ?? 0;
  }

  private filtrarTiposComercioPorPaquete(nivel: string, tipos: string[]): string[] {
    if (this.tipoNegocioSeleccionado?.id === 'comercio-unico') {
      const tipoUnico = nivel === 'Caja' ? 'Cuenta Terminal Pin Rapido' : 'Sucursales Únicas';
      return tipos.includes(tipoUnico) ? [tipoUnico] : [];
    }

    if (this.contextoComercio === 'paquete' && nivel === 'Sub Afiliado') {
      return tipos.includes('Empresa Holding') ? ['Empresa Holding'] : [];
    }

    if (this.contextoComercio === 'paquete' && nivel === 'Entidad') {
      if (this.tipoNegocioSeleccionado?.id === 'auditor-unico') {
        return tipos.filter(tipo => tipo.toLowerCase().includes('agrupadora'));
      }

      const permitidos = ['Persona Física', 'Empresa Grupo'];
      return permitidos.filter(tipo => tipos.includes(tipo));
    }

    return tipos;
  }

  private extraerTiposComercioCatalogo(response: unknown): Array<{ id: number; nombre: string }> {
    return this.extraerListaTiposComercio(response)
      .map(tipo => ({
        id: this.valorNumero(
          tipo.idTypeOfBusiness
          ?? tipo.typeOfBusiness
          ?? tipo.id
          ?? tipo.value
          ?? tipo.code
        ),
        nombre: this.valorTexto(
          tipo.description
          ?? tipo.descripcion
          ?? tipo.name
          ?? tipo.nombre
          ?? tipo.label
          ?? tipo.businessType
          ?? tipo.typeBusiness
        ),
      }))
      .filter(tipo => tipo.id > 0 && !!tipo.nombre);
  }

  private extraerListaTiposComercio(response: unknown): TipoComercioCatalogo[] {
    if (Array.isArray(response)) return response as TipoComercioCatalogo[];
    if (!response || typeof response !== 'object') return [];

    const body = response as Record<string, unknown>;
    const possibleLists = [
      body['data'],
      body['response'],
      body['result'],
      body['items'],
      body['object'],
      body['payload'],
      body['content'],
      body['typeOfBusinesses'],
      body['catTypeOfBusinesses'],
    ];

    const list = possibleLists.find(Array.isArray);
    if (Array.isArray(list)) return list as TipoComercioCatalogo[];

    for (const value of Object.values(body)) {
      const nestedList = this.extraerListaTiposComercio(value);
      if (nestedList.length) return nestedList;
    }

    return [];
  }

  private consultarLocalidadesPorCodigoPostal(codigoPostal: string, addressType: 'DF' | 'DC' | 'REP'): void {
    const cp = codigoPostal.trim();
    if (!/^\d{5}$/.test(cp)) {
      if (addressType === 'DF') this.localidadesFiscal = [];
      if (addressType === 'DC') this.localidadesComercial = [];
      if (addressType === 'REP') this.localidadesRepresentante = [];
      if (addressType === 'DF') this.cargandoLocalidadesFiscal = false;
      if (addressType === 'DC') this.cargandoLocalidadesComercial = false;
      if (addressType === 'REP') this.cargandoLocalidadesRepresentante = false;
      return;
    }

    if (addressType === 'DF') this.cargandoLocalidadesFiscal = true;
    if (addressType === 'DC') this.cargandoLocalidadesComercial = true;
    if (addressType === 'REP') this.cargandoLocalidadesRepresentante = true;

    this.localidadesService.obtenerPorCodigoPostal(cp).subscribe({
      next: response => {
        const localidades = [...response];
        if (addressType === 'DF') {
          this.localidadesFiscal = localidades;
          this.cargandoLocalidadesFiscal = false;
          this.precargarLocalidadPorCodigoPostal(localidades[0], 'DF');
        }
        if (addressType === 'DC') {
          this.localidadesComercial = localidades;
          this.cargandoLocalidadesComercial = false;
          this.precargarLocalidadPorCodigoPostal(localidades[0], 'DC');
        }
        if (addressType === 'REP') {
          this.localidadesRepresentante = localidades;
          this.cargandoLocalidadesRepresentante = false;
          this.precargarLocalidadPorCodigoPostal(localidades[0], 'REP');
        }
        this.cdr.detectChanges();
      },
      error: error => {
        void error;
        if (addressType === 'DF') this.localidadesFiscal = [];
        if (addressType === 'DC') this.localidadesComercial = [];
        if (addressType === 'REP') this.localidadesRepresentante = [];
        if (addressType === 'DF') this.cargandoLocalidadesFiscal = false;
        if (addressType === 'DC') this.cargandoLocalidadesComercial = false;
        if (addressType === 'REP') this.cargandoLocalidadesRepresentante = false;
      }
    });
  }

  private precargarLocalidadPorCodigoPostal(localidad: CodigoPostalLocalizacion | undefined, addressType: 'DF' | 'DC' | 'REP'): void {
    if (!localidad) return;

    if (addressType === 'DF') {
      this.datosForm.patchValue({
        colonia: '',
        localidad: localidad.municipio || '',
        municipio: localidad.municipio || '',
        entidadFederativa: localidad.estado || '',
        locationID: '',
      }, { emitEvent: false });
      return;
    }

    if (addressType === 'REP') {
      this.datosForm.patchValue({
        coloniaRepresentante: '',
        municipioRepresentante: localidad.municipio || '',
        estadoRepresentante: localidad.estado || '',
        locationIDRepresentante: '',
      }, { emitEvent: false });
      return;
    }

    this.datosForm.patchValue({
      coloniaComercial: '',
      localidadComercial: localidad.municipio || '',
      municipioComercial: localidad.municipio || '',
      entidadFederativaComercial: localidad.estado || '',
      locationIDComercial: '',
    }, { emitEvent: false });
  }

  seleccionarLocalidad(idLocalidad: string, addressType: 'DF' | 'DC' | 'REP'): void {
    const localidades = addressType === 'DF'
      ? this.localidadesFiscal
      : addressType === 'DC'
        ? this.localidadesComercial
        : this.localidadesRepresentante;
    const localidad = localidades.find(item => item.idLocalidad === idLocalidad);
    if (!localidad) return;

    if (addressType === 'DF') {
      this.datosForm.patchValue({
        colonia: localidad.colonia || '',
        localidad: localidad.colonia || '',
        municipio: localidad.municipio || '',
        entidadFederativa: localidad.estado || '',
        locationID: localidad.idLocalidad || '',
      });
      return;
    }

    if (addressType === 'REP') {
      this.datosForm.patchValue({
        coloniaRepresentante: localidad.colonia || '',
        municipioRepresentante: localidad.municipio || '',
        estadoRepresentante: localidad.estado || '',
        locationIDRepresentante: localidad.idLocalidad || '',
      });
      return;
    }

    this.datosForm.patchValue({
      coloniaComercial: localidad.colonia || '',
      localidadComercial: localidad.colonia || '',
      municipioComercial: localidad.municipio || '',
      entidadFederativaComercial: localidad.estado || '',
      locationIDComercial: localidad.idLocalidad || '',
    });
  }

  // ── Getters ──────────────────────────────────────────────────────────────────
  get progresoWizard(): number {
    const progreso = this.calcularProgresoPreregistro();
    return Math.min(100, Math.max(0, progreso));
  }

  get documentosVisibles(): DocumentoRequerido[] {
    const nivel = this.comercioForm.getRawValue().nivel;
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const tipoEfectivo = ['Referenciador', 'Comisionista'].includes(nivel) ? nivel : tipo;
    const reglas = this.obtenerReglasDocumentos(tipoEfectivo, this.datosForm.controls.tipoPersona.value);
    const documentosGuardados = this.documentosPorNodo[this.nodoDocumentosActualId()] ?? {};

    return reglas
      .map((regla): DocumentoRequerido | undefined => {
        const documento = this.documentoDesdeRegla(regla, tipoEfectivo, this.datosForm.controls.tipoPersona.value);
        if (!documento) return undefined;
        const guardado = documentosGuardados[documento.numero];
        return {
          ...documento,
          archivo: guardado?.archivo,
          archivoNombre: guardado?.archivoNombre,
        };
      })
      .filter((documento): documento is DocumentoRequerido => !!documento);
  }

  private obtenerReglasDocumentos(tipoComercio: string, tipoPersona: unknown): ReglaDocumento[] {
    const tipoPersonaNormalizada = this.tipoPersonaPayload(tipoPersona);
    if (['Empresa Agrupadora', 'Entidad Agrupadora'].includes(tipoComercio)) {
      if (tipoPersonaNormalizada === 'PF') {
        return this.documentosPorTipoComercio['Persona Física'] ?? [];
      }

      return this.documentosPorTipoComercio[tipoComercio] ?? this.documentosPorTipoComercio['Empresa Grupo'] ?? [];
    }
    if (['Empresa Grupo', 'Sucursales de Grupo'].includes(tipoComercio) && tipoPersonaNormalizada === 'PF') {
      return this.documentosPorTipoComercio['Persona Física'] ?? [];
    }
    if (tipoComercio === 'Sucursales Únicas' && tipoPersonaNormalizada === 'PF') {
      return this.documentosPorTipoComercio['Sucursal Persona Física'] ?? [];
    }
    return this.documentosPorTipoComercio[tipoComercio] ?? [];
  }

  private documentoDesdeRegla(regla: ReglaDocumento, tipoComercio: string, tipoPersona: unknown): DocumentoRequerido | undefined {
    const documento = this.documentos.find(d => d.numero === regla.numero);
    if (!documento) return undefined;
    const tipoPersonaNormalizada = this.tipoPersonaPayload(tipoPersona);
    const nombre = tipoPersonaNormalizada === 'PF'
      && ['Empresa Grupo', 'Sucursales de Grupo', 'Persona Física', 'Sucursal Persona Física', 'Sucursales Únicas'].includes(tipoComercio)
      && regla.numero === 3
        ? 'Identificación Oficial'
        : documento.nombre;
    return { ...documento, nombre, obligatorio: regla.obligatorio };
  }


  get camposDatosGenerales(): string[] {
    const tipo = this.comercioForm.getRawValue().tipoComercio;
    const nivel = this.comercioForm.getRawValue().nivel;
    const esSinTipo = ['Referenciador', 'Comisionista'].includes(nivel);
    const campos = this.datosGeneralesPorTipo[esSinTipo ? nivel : tipo] ?? [];
    if (campos.length === 0) return campos;
    const esRegistroPersonaFisica = this.datosForm.controls.tipoPersona.value === 'PF' || tipo === 'Persona Física';
    const camposContactoPersona = this.mostrarRepresentante || campos.includes('tipoPersona') || esRegistroPersonaFisica
      ? []
      : ['correo', 'telefono'];
    return Array.from(new Set([...campos, ...camposContactoPersona]));
  }

  get pasoGeneralesDebeSaltarse(): boolean {
    return this.camposDatosGenerales.length === 0;
  }

  get pasosVisibles() {
    return this.pasos.filter(paso =>
      (paso.numero !== 2 || !this.pasoGeneralesDebeSaltarse) &&
      (paso.numero !== 3 || this.mostrarPasoAccesos) &&
      (paso.numero !== 4 || this.mostrarCuentaLiquidacion) &&
      (paso.numero !== 5 || this.mostrarPasoDocumentos)
    );
  }

  get mostrarPasoAccesos(): boolean { return false; } // Temporal: se omite Accesos/TPV del flujo.
  get mostrarAdminTotal(): boolean { return this.modoReservaActual !== 'COMPLETO'; }
  get mostrarPerfilReserva(): boolean { return this.modoReservaActual !== 'NINGUNO'; }
  get mostrarReservaSplit(): boolean { return this.modoReservaActual === 'TRANSACCIONAL'; }
  get mostrarPinSupervisor(): boolean { return this.accesosForm.controls.tieneSupervisor.value === 'si'; }
  get mostrarCuentaLiquidacion(): boolean { return false; }
  get mostrarPasoDocumentos(): boolean { return this.documentosVisibles.length > 0; }
  get pasoDocumentosAnterior(): PasoWizard {
    if (this.mostrarCuentaLiquidacion) return 4;
    if (this.mostrarPasoAccesos) return 3;
    return this.pasoGeneralesDebeSaltarse ? 1 : 2;
  }
  get mostrarBeneficiarioIgualComercio(): boolean { return !this.pasoGeneralesDebeSaltarse; }
  get esComercioUnico(): boolean { return this.tipoNegocioSeleccionado?.id === 'comercio-unico'; }
  get mostrarMismaInfoAccesoDatos(): boolean {
    return this.datosForm.controls.tipoPersona.value === 'PF'
      && this.camposDatosGenerales.includes('nombre')
      && this.camposDatosGenerales.includes('apellidoPaterno')
      && this.camposDatosGenerales.includes('apellidoMaterno');
  }
  get bloquearNivelComercio(): boolean { return !!this.tipoNegocioSeleccionado || this.contextoComercio === 'caja'; }
  get bloquearTipoComercio(): boolean {
    return this.esComercioUnico
      || this.tiposComercio.length === 1;
  }
  get nivelesComercioVisibles(): string[] {
    const nivelActual = this.comercioForm.controls.nivel.value;
    return this.bloquearNivelComercio && nivelActual ? [nivelActual] : this.niveles;
  }
  get mostrarInfoFiscalEntidadSucursal(): boolean {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    return !this.esComercioUnico && nodo?.nivel === 'sucursal' && !!this.buscarEntidadPadre(nodo.id);
  }
  get bloquearTipoPersonaSucursal(): boolean {
    return !!this.tipoPersonaForzadaPorTexto(this.tipoComercioDescripcionActual)
      || (this.mostrarInfoFiscalEntidadSucursal && this.datosForm.controls.mismaInfoFiscalEntidad.value);
  }
  get mostrarContactoAccesoDescripcion(): boolean {
    return this.nivelComercioActual === this.nivelContactoAccesoActual;
  }
  private get esSucursalPaqueteSucursalesMultiples(): boolean {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    return this.tipoNegocioSeleccionado?.id === 'sucursales-multiples'
      && nodo?.nivel === 'sucursal'
      && !!this.buscarEntidadPadre(nodo.id);
  }
  get ocultarContactoPersonaMoralDescripcion(): boolean {
    const tipoComercio = this.tipoComercioDescripcionActual;
    return ['Empresa Holding', 'Empresa Grupo', 'Sucursales de Grupo'].includes(tipoComercio);
  }
  private get nivelComercioActual(): string {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    return nodo ? this.nivelClientePorNodo(nodo) : this.comercioForm.getRawValue().nivel;
  }
  private get nivelContactoAccesoActual(): string {
    const paqueteId = this.tipoNegocioSeleccionado?.id || this.buscarTipoNegocioDesdeComercio()?.id || '';
    return this.nivelContactoAccesoPorPaquete[paqueteId] || this.comercioForm.getRawValue().nivel;
  }
  private get tipoComercioDescripcionActual(): string {
    return this.valorTexto(this.comercioForm.getRawValue().tipoComercio) || this.tipoComercioEfectivoActual();
  }
  get mostrarCheckMismoDomicilio(): boolean {
    if (this.tipoNegocioSeleccionado?.id !== 'sucursales-multiples') return true;

    const nodoActual = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    if (nodoActual?.nivel !== 'sucursal') return true;
    if (this.datosForm.controls.mismoDomicilio.value) return true;

    const datosPorSucursal = this.obtenerDatosPorSucursal();
    return !Object.entries(datosPorSucursal).some(([nodoId, datos]) => {
      const nodo = this.buscarNodoArbol(nodoId);
      return nodo?.nivel === 'sucursal' && nodoId !== nodoActual.id && datos['mismoDomicilio'] === true;
    });
  }
  get pasoActualLabel(): string { return this.pasos[this.pasoActual - 1]?.titulo ?? 'Validación'; }
  get documentosCargados(): number { return this.documentosVisibles.filter(d => !!(d.archivo || d.archivoNombre)).length; }
  get documentosPendientes(): number { return this.documentosVisibles.filter(d => d.obligatorio && !d.archivo && !d.archivoNombre).length; }
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
      return { nivelPadre: 'Entidad', mostrarEntidades: false, mostrarSucursales: true, mostrarCajas: true, entidadesBase: 1, sucursalesBase: 1, cajasBase: 1 };
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

  // ── Navegación ───────────────────────────────────────────────────────────────
  irAlPaso(paso: number): void {
    if (paso === 3 && !this.mostrarPasoAccesos) {
      paso = this.mostrarCuentaLiquidacion ? 4 : this.mostrarPasoDocumentos ? 5 : 2;
    }
    if (paso === 5) {
      this.cargarDocumentosNodo(this.nodoDocumentosActualId());
    }
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
    const tipoForzado = this.tipoComercioForzadoPorEntidad(nodo);
    this.tiposComercio = tipoForzado
      ? [tipoForzado]
      : this.esComercioUnico
      ? [this.tipoComercioAutomaticoPorNodo(nodo)]
      : this.filtrarTiposComercioPorPaquete(nivel, this.tiposComercioPorNivel[nivel] ?? []);
    this.cargarTiposComercioCatalogo(nivel);
    this.comercioForm.patchValue({
      nivel,
      tipoComercio: tipoForzado
        || comercioGuardado?.tipoComercio
        || this.tipoComercioAutomaticoPorNodo(nodo),
      tipoComercioId: comercioGuardado?.tipoComercioId
        || this.typeOfBusinessPayload(nodo.id, tipoForzado || comercioGuardado?.tipoComercio || this.tipoComercioAutomaticoPorNodo(nodo)),
    }, { emitEvent: false });
    this.comercioForm.controls.tipoComercio.setValidators([Validators.required]);
    this.comercioForm.controls.tipoComercio.updateValueAndValidity({ emitEvent: false });
    this.actualizarValidadoresDatos();
    if (this.esDescripcionComercioAutomatica(nodo)) {
      this.guardarComercioNodoActual();
      this.pasosCompletados.add(1);
    } else {
      this.pasosCompletados.delete(1);
    }
    this.pasosCompletados.delete(2);
    this.pasosCompletados.delete(3);
    this.pasosCompletados.delete(5);
    this.pasoActual = this.esDescripcionComercioAutomatica(nodo) ? 2 : 1;
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
    this.errorAfiliacion = '';
    if (this.afiliacionForm.invalid) { this.afiliacionForm.markAllAsTouched(); return; }

    const affiliationNumber = this.afiliacionForm.controls.afiliacion.value.trim();
    this.validandoAfiliacion = true;

    this.validarAfiliacionService.validar(affiliationNumber).subscribe({
      next: response => {
        this.validandoAfiliacion = false;
        if (response?.success === false) {
          this.afiliacionForm.controls.afiliacion.setErrors({ afiliacionInvalida: true });
          this.errorAfiliacion = response.error?.message || 'No fue posible validar el número de afiliación.';
          return;
        }
        this.guardarBorradorSilencioso();
        this.irAlPaso(6);
      },
      error: error => {
        this.validandoAfiliacion = false;
        this.afiliacionForm.controls.afiliacion.setErrors({ afiliacionInvalida: true });
        this.errorAfiliacion = this.extraerMensajeErrorHttp(error) || 'No fue posible validar el número de afiliación.';
      },
    });
  }

  seleccionarTipoNegocio(tipo: TipoNegocio): void {
    this.tipoNegocioSeleccionado = tipo;
    this.contextoComercio = 'paquete';
    this.comercioForm.patchValue({
      nivel: tipo.nivel,
      tipoComercio: tipo.tipoComercio,
      tipoComercioId: this.typeOfBusinessPayload('', tipo.tipoComercio),
    }, { emitEvent: false });
    this.tiposComercio = tipo.id === 'comercio-unico'
      ? [tipo.tipoComercio]
      : this.filtrarTiposComercioPorPaquete(tipo.nivel, this.tiposComercioPorNivel[tipo.nivel] ?? []);
    if (this.requiereArbolNegocio(tipo)) {
      this.configurarArbolPorTipo(tipo);
      this.arbolNegocioForm.patchValue({
        numeroEntidades: this.arbolNegocioForm.controls.numeroEntidades.value || '1',
        numeroSucursales: this.arbolNegocioForm.controls.numeroSucursales.value || '1',
        numeroCajas: this.arbolNegocioForm.controls.numeroCajas.value || '1',
        cajasPorSucursal: this.arbolNegocioForm.controls.cajasPorSucursal.value,
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
        if (primerNodo) this.cargarDatosSucursal(primerNodo.id);
        if (this.camposDatosGenerales.includes('tipoPersona')) {
          this.pasosCompletados.delete(1);
          this.guardarBorradorSilencioso();
          this.irAlPaso(1);
          return;
        }
        this.guardarComercioAutomaticoComercioUnico();
        this.marcarPasoCompletado(1);
        this.guardarBorradorSilencioso();
        this.irAlPaso(2);
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
    this.precargarTiposComercioArbol();
    this.accesosForm.controls.cajasTPV.setValue(String(Math.max(...Object.values(this.obtenerCajasPorSucursal()))));
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value) || this.primerNodoCapturableArbol();
    if (nodo) this.aplicarComercioPorNodo(nodo);
    this.irAlPaso(nodo && this.esDescripcionComercioAutomatica(nodo) ? 2 : 1);
  }

  /* continuarComercio(): void {
     if (this.comercioForm.invalid) { this.comercioForm.markAllAsTouched(); return; }
     this.marcarPasoCompletado(1); this.guardarBorradorSilencioso(); this.irAlPaso(2);
   }*/

  continuarComercio(): void {
    if (this.comercioForm.invalid) { this.comercioForm.markAllAsTouched(); return; }
    this.guardarComercioNodoActual();
    if (this.camposDatosGenerales.includes('tipoPersona') || this.mostrarContactoAccesoDescripcion) {
      this.guardarDatosSucursalActual();
    }
    this.marcarPasoCompletado(1);
    this.guardarBorradorSilencioso();
    if (this.pasoGeneralesDebeSaltarse) {
      this.marcarPasoCompletado(2); // paso 2 se auto-completa
      this.continuarDesdePasoSinAccesos();
    } else {
      const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
      this.cargarDatosSucursal(nodoId);
      this.irAlPaso(2);
    }
  }

  continuarDatos(): void {
     if (this.datosForm.invalid) { this.datosForm.markAllAsTouched(); return; }
     this.guardarDatosSucursalActual();
     this.marcarPasoCompletado(2);
     this.guardarBorradorSilencioso();
     if (this.mostrarPasoAccesos) {
       this.irAlPaso(3);
     } else {
       this.continuarDesdePasoSinAccesos();
     }
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

  alternarMismaInfoAcceso(usarInfoAcceso: boolean): void {
    this.datosForm.controls.mismaInfoAcceso.setValue(usarInfoAcceso, { emitEvent: false });
    if (usarInfoAcceso) {
      this.datosForm.patchValue({
        nombre: this.datosForm.controls.nombreAcceso.value,
        apellidoPaterno: this.datosForm.controls.apellidoPaternoAcceso.value,
        apellidoMaterno: this.datosForm.controls.apellidoMaternoAcceso.value,
      });
      this.datosForm.controls.nombre.markAsTouched();
      this.datosForm.controls.apellidoPaterno.markAsTouched();
      this.datosForm.controls.apellidoMaterno.markAsTouched();
    } else {
      this.datosForm.patchValue({
        nombre: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
      });
      this.datosForm.controls.nombre.markAsUntouched();
      this.datosForm.controls.apellidoPaterno.markAsUntouched();
      this.datosForm.controls.apellidoMaterno.markAsUntouched();
    }
    this.guardarBorradorSilencioso();
  }

  alternarMismaInfoAccesoRepresentante(usarInfoAcceso: boolean): void {
    this.datosForm.controls.mismaInfoAccesoRepresentante.setValue(usarInfoAcceso, { emitEvent: false });
    if (usarInfoAcceso) {
      this.datosForm.patchValue(this.obtenerDatosParaRepresentanteDesdeCheck() as any);
      [
        'nombreRepresentante',
        'apellidoPaternoRepresentante',
        'apellidoMaternoRepresentante',
        'calleRepresentante',
        'numeroExteriorRepresentante',
        'numeroInteriorRepresentante',
        'codigoPostalRepresentante',
        'coloniaRepresentante',
        'municipioRepresentante',
        'estadoRepresentante',
        'locationIDRepresentante',
        'correoRepresentante',
        'telefonoRepresentante',
        'telefonoAdicionalRepresentante',
      ].forEach(campo => this.datosForm.get(campo)?.markAsTouched());
    } else {
      this.datosForm.patchValue({
        nombreRepresentante: '',
        apellidoPaternoRepresentante: '',
        apellidoMaternoRepresentante: '',
        calleRepresentante: '',
        numeroExteriorRepresentante: '',
        numeroInteriorRepresentante: '',
        codigoPostalRepresentante: '',
        coloniaRepresentante: '',
        municipioRepresentante: '',
        estadoRepresentante: '',
        locationIDRepresentante: '',
        correoRepresentante: '',
        telefonoRepresentante: '',
        telefonoAdicionalRepresentante: '',
      });
      [
        'nombreRepresentante',
        'apellidoPaternoRepresentante',
        'apellidoMaternoRepresentante',
        'calleRepresentante',
        'numeroExteriorRepresentante',
        'numeroInteriorRepresentante',
        'codigoPostalRepresentante',
        'coloniaRepresentante',
        'municipioRepresentante',
        'estadoRepresentante',
        'locationIDRepresentante',
        'correoRepresentante',
        'telefonoRepresentante',
        'telefonoAdicionalRepresentante',
      ].forEach(campo => this.datosForm.get(campo)?.markAsUntouched());
    }
    this.guardarBorradorSilencioso();
  }

  private obtenerDatosParaRepresentanteDesdeCheck(): Record<string, string> {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const entidad = this.esSucursalPaqueteSucursalesMultiples && nodo ? this.buscarEntidadPadre(nodo.id) : undefined;
    const datosEntidad = entidad ? this.obtenerDatosPorSucursal()[entidad.id] : undefined;
    const entidadEsPersonaMoral = this.tipoPersonaPayload(datosEntidad?.['tipoPersona']) === 'PM';
    const sucursalEsPersonaMoral = this.tipoPersonaPayload(this.datosForm.controls.tipoPersona.value) === 'PM';

    if (datosEntidad && entidadEsPersonaMoral && sucursalEsPersonaMoral) {
      return Object.fromEntries([
        ...this.camposNombreRepresentante,
        ...this.camposDireccionRepresentante,
        'correoRepresentante',
        'telefonoRepresentante',
        'telefonoAdicionalRepresentante',
      ].map(campo => [campo, this.valorTexto(datosEntidad[campo])]));
    }

    return {
      nombreRepresentante: this.valorTexto(datosEntidad?.['nombreAcceso']) || this.datosForm.controls.nombreAcceso.value,
      apellidoPaternoRepresentante: this.valorTexto(datosEntidad?.['apellidoPaternoAcceso']) || this.datosForm.controls.apellidoPaternoAcceso.value,
      apellidoMaternoRepresentante: this.valorTexto(datosEntidad?.['apellidoMaternoAcceso']) || this.datosForm.controls.apellidoMaternoAcceso.value,
      correoRepresentante: this.valorTexto(datosEntidad?.['correo']) || this.datosForm.controls.correo.value,
      telefonoRepresentante: this.valorTexto(datosEntidad?.['telefono']) || this.datosForm.controls.telefono.value,
    };
  }

  volverDesdeComercio(): void {
    if (this.mostrarArbolWizard && this.retrocederANodoAnteriorArbol()) {
      this.guardarBorradorSilencioso();
      return;
    }

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

  private continuarDesdePasoSinAccesos(): void {
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
    this.errorEnvioPreRegistro = '';
    const pasoInvalido = this.primerPasoInvalido();
    if (pasoInvalido !== null) { this.pasoActual = pasoInvalido; this.registroTerminado = false; return; }
    this.cargarDocumentosNodo(this.nodoDocumentosActualId());
    const faltantes = this.documentosVisibles.filter(d => d.obligatorio && !d.archivo && !d.archivoNombre);
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
    const payload = this.imprimirPayloadPreRegistro();
    this.enviarPreRegistroCompleto(payload);
    this.guardarBorradorSilencioso();
  }

  private imprimirPayloadPreRegistro(): PayloadPreRegistro {
    this.guardarDatosSucursalActual();
    this.guardarAccesosNodoActual();
    this.guardarDocumentosNodoActual();
    const payload = this.construirPayloadPreRegistro();
    const payloadJson = JSON.stringify(payload, null, 2);
    try {
      localStorage.setItem(this.payloadKey, payloadJson);
    } catch { /* no-op */ }
    return payload;
  }

  private enviarPreRegistroCompleto(payload: PayloadPreRegistro): void {
    this.preregistroCompletoService.enviarPreRegistro(payload).subscribe({
      next: (response) => {
        const documentos = this.prepararDocumentosParaSubida(response);
        console.info('[Preregistro] Registro exitoso. Documentos preparados para subida:', documentos.map(documento => ({
          guid: documento.guid,
          nombre: documento.fileName,
          tipo: documento.file.type,
          tamanoBytes: documento.file.size,
        })));
        this.preregistroDocumentosService.subirDocumentos(documentos).subscribe({
          next: () => {
            console.info('[Preregistro] Documentos subidos correctamente.');
            this.completarRegistroExitoso();
          },
          error: () => {
            console.error('[Preregistro] Error al subir documentos.');
            this.registroTerminado = false;
            this.errorEnvioPreRegistro = 'El registro se completó, pero no se pudieron subir los documentos. Intenta nuevamente.';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
        });
      },
      error: (error) => {
        this.registroTerminado = false;
        this.errorEnvioPreRegistro = this.obtenerMensajeErrorPreRegistro(error);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  private completarRegistroExitoso(): void {
    this.marcarPasoCompletado(5);
    this.registroTerminado = true;
    this.errorEnvioPreRegistro = '';
    this.guardarBorradorSilencioso();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private obtenerMensajeErrorPreRegistro(error?: unknown): string {
    const mensaje = this.extraerMensajeErrorHttp(error);
    if (mensaje.toLowerCase().includes('email ya existe')) {
      const campo = this.marcarCampoEmailDuplicado();
      return campo
        ? `${mensaje}. Revisa el campo ${campo}.`
        : mensaje;
    }

    return mensaje || 'No se pudo completar el registro. Intenta nuevamente en unos minutos.';
  }

  private extraerMensajeErrorHttp(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return this.extraerMensajeErrorBody(error.error) || error.message || '';
    }

    return this.extraerMensajeErrorBody(error);
  }

  private extraerMensajeErrorBody(error: unknown): string {
    if (typeof error === 'string') return error.trim();
    if (!this.esObjetoRespuesta(error)) return '';

    const posibles = [
      error['message'],
      error['mensaje'],
      error['error'],
      error['detail'],
      error['description'],
    ];
    const directo = posibles.find(valor => typeof valor === 'string' && valor.trim());
    if (typeof directo === 'string') return directo.trim();

    for (const value of Object.values(error)) {
      const nested = this.extraerMensajeErrorBody(value);
      if (nested) return nested;
    }

    return '';
  }

  private marcarCampoEmailDuplicado(): string {
    const campos: Array<{ campo: string; etiqueta: string }> = [
      { campo: 'correoComercial', etiqueta: 'Correo Electrónico de Contacto Comercial' },
      { campo: 'correoRepresentante', etiqueta: 'Correo Electrónico del Representante Legal' },
      { campo: 'correo', etiqueta: 'Correo electrónico' },
    ];

    const primerCampoConValor = campos.find(({ campo }) => this.valorTexto(this.datosForm.get(campo)?.value));
    if (!primerCampoConValor) return '';

    const control = this.datosForm.get(primerCampoConValor.campo);
    control?.setErrors({ ...(control.errors ?? {}), emailDuplicado: true });
    control?.markAsTouched();
    this.pasoActual = 2;

    return primerCampoConValor.etiqueta;
  }

  private prepararDocumentosParaSubida(response: unknown): DocumentoPreregistroUpload[] {
    const guidsPorNodo = this.obtenerCommerceGuidsPorNodo(response);
    console.info('[Preregistro documentos] GUIDs detectados por nodo:', guidsPorNodo);
    console.info('[Preregistro documentos] Documentos guardados por nodo:', Object.entries(this.documentosPorNodo).map(([nodoId, documentos]) => ({
      nodoId,
      documentos: Object.entries(documentos)
        .filter(([, documento]) => !!documento.archivo || !!documento.archivoNombre)
        .map(([numero, documento]) => ({
          numero: Number(numero),
          nombre: documento.archivo?.name || documento.archivoNombre || '',
          tieneArchivo: !!documento.archivo,
        })),
    })));
    return Object.entries(this.documentosPorNodo).flatMap(([nodoId, documentos]) => {
      const guids = guidsPorNodo[nodoId] ?? [];
      if (!guids.length) return [];

      return guids.flatMap(guid => Object.entries(documentos)
          .map(([numeroDocumento, documento]) => {
            const numero = Number(numeroDocumento);
            const fileName = this.nombreArchivoDocumento(guid, numero);
            if (!documento.archivo || !fileName) return undefined;

            return { guid, fileName, file: documento.archivo };
          })
          .filter((documento): documento is DocumentoPreregistroUpload => !!documento)
      );
    });
  }

  private obtenerCommerceGuidsPorNodo(response: unknown): Record<string, string[]> {
    const entitys = this.extraerEntitysRespuesta(response);
    const entidadRespuesta = entitys[0];
    const guids: Record<string, string[]> = {};

    if (this.tipoNegocioSeleccionado?.id === 'empresa-holding') {
      const subAfiliado = this.arbolNegocioWizard.find(nodo => nodo.nivel === 'sub-afiliado');
      const rootResponse = this.extraerPreRegistrationResponse(response);
      const guidSubAfiliado = this.extraerCommerceGuid(rootResponse);
      if (subAfiliado?.id && guidSubAfiliado) guids[subAfiliado.id] = [guidSubAfiliado];

      const entidadesRespuesta = this.extraerEntitysRespuesta(rootResponse);
      (subAfiliado?.hijos ?? []).forEach((entidad, entidadIndex) => {
        const entidadRespuesta = entidadesRespuesta[entidadIndex];
        const guidEntidad = this.extraerCommerceGuid(entidadRespuesta);
        if (guidEntidad) guids[entidad.id] = [guidEntidad];

        const sucursalesRespuesta = this.extraerBranchOficcesRespuesta(entidadRespuesta);
        (entidad.hijos ?? []).filter(nodo => nodo.nivel === 'sucursal').forEach((sucursal, sucursalIndex) => {
          const sucursalRespuesta = sucursalesRespuesta[sucursalIndex];
          const guid = this.extraerCommerceGuid(sucursalRespuesta);
          if (guid) guids[sucursal.id] = [guid];

          const cajasRespuesta = this.extraerPossRespuesta(sucursalRespuesta);
          (sucursal.hijos ?? []).filter(nodo => nodo.nivel === 'caja').forEach((caja, cajaIndex) => {
            const guidCaja = this.extraerCommerceGuid(cajasRespuesta[cajaIndex]);
            if (guidCaja) guids[caja.id] = [guidCaja];
          });
        });
      });

      return guids;
    }

    if (this.tipoNegocioSeleccionado?.id === 'sucursales-multiples') {
      const entidad = this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => nodo.nivel === 'entidad');
      const sucursales = (entidad?.hijos ?? this.aplanarArbolNegocio(this.arbolNegocioWizard))
        .filter(nodo => nodo.nivel === 'sucursal');
      const guidEntidad = this.extraerCommerceGuid(entidadRespuesta);

      const sucursalesRespuesta = this.extraerBranchOficcesRespuesta(entidadRespuesta);
      sucursales.forEach((sucursal, index) => {
        const guid = this.extraerCommerceGuid(sucursalesRespuesta[index]);
        if (guid) {
          guids[sucursal.id] = [guid];
        }
      });
      if (entidad?.id && guidEntidad) guids[entidad.id] = [guidEntidad];

      return guids;
    }

    const guidPrincipal = this.extraerCommerceGuid(this.extraerBranchOficcesRespuesta(entidadRespuesta)[0])
      || this.extraerCommerceGuid(entidadRespuesta)
      || this.extraerCommerceGuid(response);
    const nodoId = this.nodoBranchOfficeActualId();
    if (guidPrincipal) guids[nodoId] = [guidPrincipal];

    return guids;
  }

  private extraerEntitysRespuesta(response: unknown): ObjetoRespuestaPreregistro[] {
    const preRegistrationRequest = this.extraerPreRegistrationResponse(response);
    const entitys = preRegistrationRequest['entitys'];
    return Array.isArray(entitys) ? entitys.filter(this.esObjetoRespuesta) : [];
  }

  private extraerPreRegistrationResponse(response: unknown): ObjetoRespuestaPreregistro {
    const root = this.extraerObjetoRespuesta(response);
    return this.esObjetoRespuesta(root['preRegistrationRequest'])
      ? root['preRegistrationRequest']
      : this.esObjetoRespuesta(root['preRegistrationResponse'])
        ? root['preRegistrationResponse']
        : this.esObjetoRespuesta(root['rows'])
          ? root['rows']
          : root;
  }

  private extraerBranchOficcesRespuesta(entity: unknown): ObjetoRespuestaPreregistro[] {
    const objeto = this.extraerObjetoRespuesta(entity);
    const branchOficces = objeto['branchOficces'] ?? objeto['branchOffices'];
    return Array.isArray(branchOficces) ? branchOficces.filter(this.esObjetoRespuesta) : [];
  }

  private extraerPossRespuesta(branchOffice: unknown): ObjetoRespuestaPreregistro[] {
    const objeto = this.extraerObjetoRespuesta(branchOffice);
    const poss = objeto['poss'] ?? objeto['pos'];
    return Array.isArray(poss) ? poss.filter(this.esObjetoRespuesta) : [];
  }

  private extraerCommerceGuid(response: unknown): string {
    const objeto = this.extraerObjetoRespuesta(response);
    const accountResponse = this.extraerObjetoRespuesta(objeto['accountResponse']);
    return this.valorTexto(objeto['commerceGuid'])
      || this.valorTexto(accountResponse['commerceGuid']);
  }

  private extraerObjetoRespuesta(response: unknown): ObjetoRespuestaPreregistro {
    return this.esObjetoRespuesta(response) ? response : {};
  }

  private esObjetoRespuesta(response: unknown): response is ObjetoRespuestaPreregistro {
    return typeof response === 'object' && response !== null && !Array.isArray(response);
  }

  private nombreArchivoDocumento(guid: string, numero: number): string | null {
    const config = this.sufijosDocumentos[numero];
    return config ? `${guid}_${config.sufijo}.${config.extension}` : null;
  }

  private construirPayloadPreRegistro(): PayloadPreRegistro {
    if (this.tipoNegocioSeleccionado?.id === 'empresa-holding') {
      return this.construirPayloadPaqueteSubAfiliado();
    }

    if (this.tipoNegocioSeleccionado?.id === 'sucursales-multiples') {
      return this.construirPayloadPaqueteSucursalesMultiples();
    }

    const nodoId = this.nodoBranchOfficeActualId();
    return {
      entitys: [
        {
          branchOficces: [
            this.construirComercioPayload(nodoId),
          ],
        },
      ],
    };
  }

  private construirPayloadPaqueteSucursalesMultiples(): { entitys: any[] } {
    const entidad = this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => nodo.nivel === 'entidad');
    const entidadId = entidad?.id || 'entidad-1';
    const sucursales = (entidad?.hijos ?? this.aplanarArbolNegocio(this.arbolNegocioWizard))
      .filter(nodo => nodo.nivel === 'sucursal');

    const { poss: _possEntidad, ...payloadEntidad } = this.construirComercioPayload(entidadId);

    return {
      entitys: [
        {
          ...payloadEntidad,
          branchOficces: sucursales.map(sucursal => this.construirComercioPayload(sucursal.id)),
        },
      ],
    };
  }

  private construirPayloadPaqueteSubAfiliado(): PayloadPreRegistro {
    const subAfiliado = this.arbolNegocioWizard.find(nodo => nodo.nivel === 'sub-afiliado');
    const subAfiliadoId = subAfiliado?.id || 'sub-afiliado-1';
    const { poss: _possSubAfiliado, ...payloadSubAfiliado } = this.construirComercioPayload(subAfiliadoId);
    const entidades = (subAfiliado?.hijos ?? [])
      .filter(nodo => nodo.nivel === 'entidad')
      .map(entidad => this.construirEntidadConSucursalesPayload(entidad));

    return {
      ...payloadSubAfiliado,
      entitys: entidades,
    };
  }

  private construirEntidadConSucursalesPayload(entidad: NodoArbolNegocio): any {
    const { poss: _possEntidad, ...payloadEntidad } = this.construirComercioPayload(entidad.id);
    return {
      ...payloadEntidad,
      branchOficces: (entidad.hijos ?? [])
        .filter(nodo => nodo.nivel === 'sucursal')
        .map(sucursal => this.construirSucursalConCajasPayload(sucursal)),
    };
  }

  private construirSucursalConCajasPayload(sucursal: NodoArbolNegocio): any {
    const { poss: _possSucursal, ...payloadSucursal } = this.construirComercioPayload(sucursal.id);
    return {
      ...payloadSucursal,
      poss: this.construirPossPayloadPorSucursal(sucursal),
    };
  }

  private construirComercioPayload(nodoId: string): any {
    const datosPorSucursal = this.obtenerDatosPorSucursal();
    const accesosPorSucursal = this.obtenerAccesosPorSucursal();
    let datos = this.combinarPreferirLlenos(datosPorSucursal[nodoId] ?? {}, this.datosForm.getRawValue());
    const accesos = this.combinarPreferirLlenos(accesosPorSucursal[nodoId] ?? {}, this.accesosForm.getRawValue());
    const comercioGuardado = this.obtenerComercioPorNodo()[nodoId];
    const comercio = comercioGuardado ?? this.comercioForm.getRawValue();
    const tipoComercioPayload = this.tipoComercioPayload(nodoId, comercio.tipoComercio);
    const typeOfBusiness = this.typeOfBusinessPayload(nodoId, tipoComercioPayload, comercio.tipoComercioId);
    const liquidacion = this.liquidacionForm.getRawValue() as Record<string, string | boolean>;
    datos = this.sincronizarRepresentanteDesdePersonaFisica(datos, tipoComercioPayload);
    const tipoPersona = this.tipoPersonaPayload(datos['tipoPersona']);
    const emailComercio = this.esComercioUnico
      ? this.valorTexto(datos['correo']) || this.valorTexto(datos['correoComercial']) || this.valorTexto(accesos['adminCorreo'])
      : this.valorTexto(datos['correoComercial']) || this.valorTexto(datos['correo']) || this.valorTexto(accesos['adminCorreo']);
    const telefonoComercio = this.esComercioUnico
      ? this.valorTexto(datos['telefono']) || this.valorTexto(datos['telefonoComercial']) || this.valorTexto(accesos['adminTelefono'])
      : this.valorTexto(datos['telefonoComercial']) || this.valorTexto(datos['telefono']) || this.valorTexto(accesos['adminTelefono']);

    return {
      nameCommerce: this.valorTexto(datos['nombreComercial']) || this.valorTexto(datos['razonSocial']),
      businessName: this.valorTexto(datos['razonSocial']) || this.valorTexto(datos['nombreComercial']),
      idBussinesLine: this.valorNumero(datos['mcc']),
      idActivity: this.valorNumero(datos['actividadId']),
      email: emailComercio,
      password: this.valorTexto(accesos['pinContrasena']),
      name: this.valorTexto(datos['nombreContactoComercial']) || this.valorTexto(datos['nombre']) || this.valorTexto(accesos['adminNombre']),
      paternalSurname: this.valorTexto(datos['apellidoPaternoContactoComercial']) || this.valorTexto(datos['apellidoPaterno']) || this.valorTexto(accesos['adminPaterno']),
      maternalSurname: this.valorTexto(datos['apellidoMaternoContactoComercial']) || this.valorTexto(datos['apellidoMaterno']) || this.valorTexto(accesos['adminMaterno']),
      phoneNumber: telefonoComercio,
      rfc: this.valorTexto(datos['rfc']),
      curp: this.valorTexto(datos['curp']),
      fiscalRegime: this.codigoRegimenFiscal(datos['regimenFiscal']),
      typePerson: tipoPersona,
      businessActivityCode: this.valorTexto(datos['mcc']),
      bussinesLineDescription: this.valorTexto(datos['descripcionGiro']),
      typeOfBusiness,
      commerceAddress: [
        this.construirDireccionPayload('DF', datos, ''),
        this.construirDireccionPayload('DC', datos, 'Comercial'),
      ],
      tradeBilling: {
        period: this.valorTexto(liquidacion['period']),
        days: this.valorTexto(liquidacion['days']),
        amount: this.valorNumero(liquidacion['amount']),
      },
      contacts: [
        this.construirContactoPayload(datos, tipoPersona, tipoComercioPayload),
      ],
      poss: this.construirPossPayload(accesos, nodoId),
    };
  }

  private construirContactoPayload(datos: Record<string, string | boolean>, tipoPersona: string, tipoComercio: string): any {
    const requiereRepresentante = this.requiereDatosRepresentante(tipoComercio, tipoPersona);

    if (tipoPersona === 'PF' || !requiereRepresentante) {
      return {
        type: 1,
        name: this.valorTexto(datos['nombre']),
        paternalSurname: this.valorTexto(datos['apellidoPaterno']),
        maternalSurname: this.valorTexto(datos['apellidoMaterno']),
        phoneNumber: this.valorTexto(datos['telefonoRepresentante']) || this.valorTexto(datos['telefono']),
        additionaPhoneNumber: '',
        email: this.valorTexto(datos['correoRepresentante']) || this.valorTexto(datos['correo']),
        address: requiereRepresentante ? this.construirDireccionRepresentantePayload(datos) : null,
      };
    }

    return {
      type: 1,
      name: this.valorTexto(datos['nombreRepresentante']),
      paternalSurname: this.valorTexto(datos['apellidoPaternoRepresentante']),
      maternalSurname: this.valorTexto(datos['apellidoMaternoRepresentante']),
      phoneNumber: this.valorTexto(datos['telefonoRepresentante']) || this.valorTexto(datos['telefonoComercial']) || this.valorTexto(datos['telefono']),
      additionaPhoneNumber: this.valorTexto(datos['telefonoAdicionalRepresentante']) || this.valorTexto(datos['telefonoAdicionalComercial']),
      email: this.valorTexto(datos['correoRepresentante']) || this.valorTexto(datos['correoComercial']) || this.valorTexto(datos['correo']),
      address: this.construirDireccionRepresentantePayload(datos),
    };
  }

  private construirDireccionRepresentantePayload(datos: Record<string, string | boolean>): Record<string, string> {
    return {
      street: this.valorTexto(datos['calleRepresentante']),
      exteriorNumber: this.valorTexto(datos['numeroExteriorRepresentante']),
      interiorNumber: this.valorTexto(datos['numeroInteriorRepresentante']),
      idLocation: this.valorTexto(datos['locationIDRepresentante']) || this.valorTexto(datos['coloniaRepresentante']),
    };
  }

  private nodoBranchOfficeActualId(): string {
    const nodoSeleccionado = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    if (nodoSeleccionado?.nivel === 'sucursal') return nodoSeleccionado.id;
    if (nodoSeleccionado?.nivel === 'caja') {
      return nodoSeleccionado.id.replace(/-caja-\d+$/, '');
    }
    const sucursal = this.aplanarArbolNegocio(this.arbolNegocioWizard).find(nodo => nodo.nivel === 'sucursal');
    return sucursal?.id || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
  }

  private tipoComercioPayload(nodoId: string, tipoActual: string): string {
    return this.valorTexto(tipoActual)
      || this.valorTexto(this.obtenerComercioPorNodo()[nodoId]?.tipoComercio)
      || this.valorTexto(this.tipoNegocioSeleccionado?.tipoComercio)
      || 'Sucursales Únicas';
  }

  private typeOfBusinessPayload(nodoId: string, tipoComercio: string, tipoComercioId?: number): number {
    return tipoComercioId
      || this.typeOfBusinessPorTipoComercio[tipoComercio]
      || 0;
  }

  private construirDireccionPayload(addressType: 'DF' | 'DC', datos: Record<string, string | boolean>, sufijo: '' | 'Comercial'): Record<string, string> {
    const campo = (nombre: string) => this.valorTexto(datos[`${nombre}${sufijo}`]);
    return {
      addressType,
      postalCode: campo('codigoPostal'),
      roadType: campo('tipoVialidad'),
      roadName: campo('nombreVialidad'),
      extNum: campo('numeroExterior'),
      intNum: campo('numeroInterior'),
      district: campo('colonia'),
      location: campo('localidad'),
      municipality: campo('municipio'),
      federativeEntity: campo('entidadFederativa'),
      betweenStreet: campo('entreCalle'),
      andStreet: campo('yCalle'),
      locationID: campo('locationID'),
    };
  }

  private construirPossPayload(accesos: Record<string, string | boolean>, nodoId?: string): any[] {
    const sucursal = nodoId ? this.buscarNodoArbol(nodoId) : undefined;
    if (sucursal?.nivel === 'sucursal') {
      return this.construirPossPayloadPorSucursal(sucursal, accesos);
    }

    const totalCajas = Math.max(1, this.valorNumero(accesos['cajasTPV'], 1));
    return this.construirPossPorTotal(totalCajas, accesos);
  }

  private construirPossPayloadPorSucursal(sucursal: NodoArbolNegocio, accesos?: Record<string, string | boolean>): any[] {
    const accesosNodo = accesos ?? this.obtenerAccesosPorSucursal()[sucursal.id] ?? this.accesosForm.getRawValue();
    const cajas = (sucursal.hijos ?? []).filter(nodo => nodo.nivel === 'caja');
    if (cajas.length) {
      return cajas.map((caja, index) => this.construirPosPayload(caja, index, accesosNodo));
    }

    return this.construirPossPorTotal(1, accesosNodo);
  }

  private construirPossPorTotal(totalCajas: number, accesos: Record<string, string | boolean>): any[] {
    return Array.from({ length: totalCajas }, (_, index) => this.construirPosPayload(undefined, index, accesos));
  }

  private construirPosPayload(caja: NodoArbolNegocio | undefined, index: number, accesos: Record<string, string | boolean>): any {
    const nombreCaja = caja?.nombre || `CAJA ${this.formatearNumero(index + 1)}`;
    const tipoComercioCaja = caja
      ? this.tipoComercioPayload(caja.id, this.obtenerComercioPorNodo()[caja.id]?.tipoComercio || this.tipoComercioAutomaticoPorNodo(caja))
      : 'Cuenta Terminal Pin Rapido';

    return {
      nameCommerce: nombreCaja,
      name: nombreCaja,
      paternalSurname: 'ND',
      maternalSurname: 'ND',
      password: this.valorTexto(accesos['pinContrasena']),
      liquidationLevel: '0',
      dispersionAccount: 'CONC_ADQUI',
      isAliasUser: true,
      typeOfBusiness: caja
        ? this.typeOfBusinessPayload(caja.id, tipoComercioCaja, this.obtenerComercioPorNodo()[caja.id]?.tipoComercioId)
        : this.typeOfBusinessPayload('', tipoComercioCaja),
    };
  }

  private precargarTiposComercioArbol(): void {
    const niveles = new Set(
      this.aplanarArbolNegocio(this.arbolNegocioWizard)
        .map(nodo => this.nivelClientePorNodo(nodo))
    );
    niveles.forEach(nivel => this.cargarTiposComercioCatalogo(nivel));
  }

  private actualizarTipoComercioIdsGuardados(tipos: Array<{ id: number; nombre: string }>): void {
    const idsPorNombre = Object.fromEntries(tipos.map(tipo => [tipo.nombre, tipo.id]));
    const comercio = this.obtenerComercioPorNodo();
    let cambio = false;

    Object.entries(comercio).forEach(([nodoId, item]) => {
      const id = idsPorNombre[item.tipoComercio];
      if (!id || item.tipoComercioId === id) return;
      comercio[nodoId] = { ...item, tipoComercioId: id };
      cambio = true;
    });

    if (cambio) {
      this.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(comercio), { emitEvent: false });
    }
  }

  private construirDocumentosPayload(nodoId: string, tipoComercio: string): any[] {
    const documentosNodo = this.documentosPorNodo[nodoId] ?? this.documentosPorNodo[this.arbolNegocioForm.controls.nodoSeleccionado.value] ?? {};
    const datosNodo = this.obtenerDatosPorSucursal()[nodoId] ?? this.datosForm.getRawValue();
    const reglas = this.obtenerReglasDocumentos(tipoComercio, datosNodo['tipoPersona']);
    return reglas
      .map(regla => {
        return this.documentoDesdeRegla(regla, tipoComercio, datosNodo['tipoPersona']);
      })
      .filter((documento): documento is DocumentoRequerido => !!documento)
      .map(documento => {
      const guardado = documentosNodo[documento.numero];
      const archivo = guardado?.archivo;
      return {
        number: documento.numero,
        name: documento.nombre,
        required: documento.obligatorio,
        fileName: guardado?.archivoNombre || archivo?.name || '',
        size: archivo?.size ?? null,
        type: archivo?.type || '',
        hasFile: !!archivo,
      };
    });
  }

  private codigoRegimenFiscal(valor: unknown): string {
    const regimen = this.valorTexto(valor);
    return regimen.split('-')[0]?.trim() || '';
  }

  private tipoPersonaPayload(valor: unknown): string {
    const tipo = this.valorTexto(valor).toLowerCase();
    if (tipo.includes('jur') || tipo.includes('moral') || tipo === 'pm') return 'PM';
    if (tipo.includes('natural') || tipo.includes('fisica') || tipo.includes('física') || tipo === 'pf') return 'PF';
    return '';
  }

  private valorTexto(valor: unknown): string {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  private valorNumero(valor: unknown, fallback = 0): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : fallback;
  }

  private combinarPreferirLlenos(
    guardado: Record<string, string | boolean>,
    actual: Record<string, string | boolean>
  ): Record<string, string | boolean> {
    const combinado = { ...guardado };
    Object.entries(actual).forEach(([clave, valor]) => {
      if (typeof valor === 'boolean' || this.valorTexto(valor)) {
        combinado[clave] = valor;
      }
    });
    return combinado;
  }

  private primerPasoInvalido(): PasoWizard | null {
    if (this.afiliacionForm.invalid) return 0;
    if (this.comercioForm.invalid) return 1;
    if (this.requiereArbolNegocio() && this.arbolNegocioForm.invalid) return 7;
    if (!this.pasoGeneralesDebeSaltarse && this.datosForm.invalid) return 2;
    if (this.mostrarPasoAccesos && this.accesosForm.invalid) return 3;
    if (this.mostrarCuentaLiquidacion && this.liquidacionForm.invalid) return 4;
    return null;
  }

  private primerNodoPendienteArbol(): NodoArbolNegocio | undefined {
    return this.nodosCapturablesParaFlujo().find(nodo => !this.nodoArbolCompletado(nodo.id));
  }

  private hayNodoSiguienteArbol(): boolean {
    const nodos = this.nodosCapturablesParaFlujo();
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
    const esImagen = this.esDocumentoImagen(documento);
    const tiposPermitidos = esImagen ? ['image/png'] : ['application/pdf'];
    const valido = !!archivo && archivo.size <= 10 * 1024 * 1024 && tiposPermitidos.includes(archivo.type);
    if (!valido) {
      documento.archivo = undefined; documento.archivoNombre = undefined;
      input.value = ''; this.archivosInvalidos = true; return;
    }
    documento.archivo = archivo; documento.archivoNombre = archivo.name;
    this.archivosInvalidos = false;
    this.guardarDocumentoNodoActual(documento);
    this.guardarBorradorSilencioso();
  }

  private esDocumentoImagen(documento: DocumentoRequerido): boolean {
    return documento.nombre.trim().toLowerCase().startsWith('imagen');
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

  // ── Ayuda / flujo ─────────────────────────────────────────────────────────────
  abrirAyuda(): void { this.mostrarAyuda = true; }
  cerrarAyuda(): void { this.mostrarAyuda = false; }

  reiniciarFlujo(): void {
    this.pasoActual = 0; this.pasosCompletados.clear();
    this.registroTerminado = false; this.archivosInvalidos = false;
    this.borradorGuardado = false; this.mostrarAyuda = false;
    this.mostrarComisionista = false;

    this.afiliacionForm.reset({ afiliacion: '' });
    this.comercioForm.reset({ nivel: '', tipoComercio: '', tipoComercioId: 0, afiliacionComisionista: '' });
    this.arbolNegocioForm.reset({ numeroEntidades: '1', numeroSucursales: '1', numeroCajas: '1', ubicacionSeleccionada: '', nivelSeleccionado: '', sucursalesPorEntidad: '', cajasPorSucursal: '', nombresArbol: '', nodosColapsados: '', nodosCompletados: '', nodoSeleccionado: '', datosPorSucursal: '', comercioPorNodo: '', accesosPorSucursal: '' });
    this.tipoNegocioSeleccionado = undefined;
    this.comisionistaForm.reset({ tipo: 'existente', afiliacion: '', correo: '', confirmarCorreo: '', telefono: '', nombre: '', paterno: '', materno: '', rfc: '' });
    this.datosForm.reset({ razonSocial: '', nombreComercial: '', rfc: '', regimenFiscal: '', giroComercial: '', descripcionGiro: '', mcc: '', mismaInfoAcceso: false, mismaInfoAccesoRepresentante: false, nombreAcceso: '', apellidoPaternoAcceso: '', apellidoMaternoAcceso: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '', curp: '', actividad: '', actividadId: '', tipoPersona: '', correo: '', telefono: '', departamento: '', ciudad: '', direccionComercial: '', nombreContactoComercial: '', apellidoPaternoContactoComercial: '', apellidoMaternoContactoComercial: '' });
    this.accesosForm.reset({ modoReserva: 'NINGUNO', cajasTPV: '1', tieneSupervisor: 'si', reservaSplit: '', adminNombre: '', adminPaterno: '', adminMaterno: '', adminCorreo: '', adminConfirmarCorreo: '', adminTelefono: '', perfilReservaNombre: '', perfilReservaPaterno: '', perfilReservaMaterno: '', perfilReservaCorreo: '', perfilReservaConfirmarCorreo: '', perfilReservaTelefono: '', pinAdministrador: '', pinCorreo: '', pinConfirmarCorreo: '', pinContrasena: '' });
    this.liquidacionForm.reset({ cuentaFueraRed: 'no', digitoVerificador: '', tipoPersonaBeneficiario: 'fisica', beneficiarioIgualComercio: false, nombreBeneficiario: '', apellidoPaternoBeneficiario: '', apellidoMaternoBeneficiario: '', correoBeneficiario: '', direccionBeneficiario: '', rfcBeneficiario: '', actividadBeneficiario: '', giroBeneficiario: '', tipoCuenta: '', cuentaClabe: '', nombreBanco: '', direccionBanco: '', telefonoBanco: '', emailBanco: '' });
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
      const payload = this.registroTerminado ? this.construirPayloadPreRegistro() : undefined;
      const payloadJson = payload ? JSON.stringify(payload, null, 2) : undefined;
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
        payload,
        payloadJson,
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
      if (this.pasoActual === 3 && !this.mostrarPasoAccesos) {
        this.pasoActual = this.mostrarCuentaLiquidacion ? 4 : this.mostrarPasoDocumentos ? 5 : 2;
      }
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
    return this.requiereArbolNegocio(tipo);
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

  private nodosCapturablesParaFlujo(): NodoArbolNegocio[] {
    const nodos = this.aplanarArbolNegocio(this.arbolNegocioWizard);
    return this.esComercioUnico ? nodos.filter(nodo => nodo.nivel !== 'caja') : nodos;
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

  private calcularProgresoPreregistro(): number {
    const unidadesIniciales = 2; // afiliación + selección/configuración del paquete
    const nodos = this.mostrarArbolWizard ? this.nodosCapturablesParaFlujo() : [];
    const pasosPorNodo = this.pasosVisibles.length || 1;
    const total = unidadesIniciales + Math.max(nodos.length, 1) * pasosPorNodo;
    let completadas = 0;

    if (this.afiliacionForm.valid && this.pasoActual !== 0) completadas += 1;
    if (this.tipoNegocioSeleccionado || this.pasosCompletados.has(1)) completadas += 1;

    if (nodos.length) {
      nodos.forEach(nodo => {
        completadas += this.unidadesCompletadasNodo(nodo, pasosPorNodo);
      });
    } else {
      completadas += this.unidadesCompletadasFlujoActual(pasosPorNodo);
    }

    return (completadas / total) * 100;
  }

  private unidadesCompletadasNodo(nodo: NodoArbolNegocio, pasosPorNodo: number): number {
    if (this.nodoArbolCompletado(nodo.id)) return pasosPorNodo;

    const actualId = this.arbolNegocioForm.controls.nodoSeleccionado.value || this.primerNodoCapturableArbol()?.id || 'sucursal-1';
    if (nodo.id === actualId) return this.unidadesCompletadasFlujoActual(pasosPorNodo);

    const tipoComercio = this.obtenerComercioPorNodo()[nodo.id]?.tipoComercio || this.tipoComercioAutomaticoPorNodo(nodo);
    let unidades = 0;
    if (tipoComercio) unidades += 1;
    if (this.datosNodoCompletos(nodo.id, tipoComercio)) unidades += 1;
    if (this.mostrarPasoAccesos && this.accesosNodoCompletos(nodo.id)) unidades += 1;
    if (this.mostrarCuentaLiquidacion) unidades += this.pasosCompletados.has(4) ? 1 : 0;
    if (this.mostrarPasoDocumentos && this.documentosNodoCompletos(nodo.id, tipoComercio)) unidades += 1;

    return Math.min(unidades, pasosPorNodo);
  }

  private unidadesCompletadasFlujoActual(pasosPorNodo: number): number {
    let unidades = 0;
    this.pasosVisibles.forEach(paso => {
      if (this.pasosCompletados.has(paso.numero)) unidades += 1;
    });

    const indicePasoActual = this.pasosVisibles.findIndex(paso => paso.numero === this.pasoActual);
    if (indicePasoActual > 0) unidades = Math.max(unidades, indicePasoActual);

    return Math.min(unidades, pasosPorNodo);
  }

  private datosNodoCompletos(id: string, tipoComercio: string): boolean {
    const datos = this.obtenerDatosPorSucursal()[id];
    if (!datos) return false;

    const tipoPersona = `${datos['tipoPersona'] || ''}`;
    const baseCampos = this.datosGeneralesPorTipo[tipoComercio] ?? [];
    const camposContactoPersona = this.tipoComercioMuestraRepresentante(tipoComercio, tipoPersona) ? [] : ['correo', 'telefono'];
    const camposRequeridos = (baseCampos.length ? Array.from(new Set([...baseCampos, ...camposContactoPersona])) : [])
      .filter(campo => !this.camposDinamicosOpcionales.includes(campo))
      .filter(campo => {
        if (tipoPersona === 'PF') return !['razonSocial', 'giroComercial', 'descripcionGiro', 'mcc'].includes(campo);
        if (tipoPersona === 'PM') return !['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad'].includes(campo);
        return true;
      });
    if (!camposRequeridos.length) return true;

    const camposComerciales = [
      'codigoPostalComercial',
      'tipoVialidadComercial',
      'nombreVialidadComercial',
      'numeroExteriorComercial',
      'coloniaComercial',
      'localidadComercial',
      'municipioComercial',
      'entidadFederativaComercial',
      'entreCalleComercial',
      'yCalleComercial',
      'correoComercial',
      'telefonoComercial',
    ];

    const camposRequeridosFinales = tipoPersona === 'PF'
      ? Array.from(new Set([...camposRequeridos, 'actividadId']))
      : camposRequeridos;

    return [...camposRequeridosFinales, ...camposComerciales]
      .every(campo => `${datos[campo] || ''}`.trim().length > 0);
  }

  private tipoComercioMuestraRepresentante(tipoComercio: string, tipoPersona: string): boolean {
    if (this.tiposCaja.includes(tipoComercio)) return false;
    if (['Persona Física', 'Sucursal Persona Física', 'Referenciador', 'Comisionista'].includes(tipoComercio)) return false;
    if (tipoComercio === 'Sucursales Únicas' && tipoPersona === 'PF') return false;
    return true;
  }

  private accesosNodoCompletos(id: string): boolean {
    return !!this.obtenerAccesosPorSucursal()[id];
  }

  private documentosNodoCompletos(id: string, tipoComercio: string): boolean {
    const datosNodo = this.obtenerDatosPorSucursal()[id] ?? this.datosForm.getRawValue();
    const reglas = this.obtenerReglasDocumentos(tipoComercio, datosNodo['tipoPersona']);
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
    this.aplicarTipoPersonaForzadaPorComercio(nodoId);
    const datos = this.obtenerDatosPorSucursal();
    const datosNodo = this.sincronizarRepresentanteDesdePersonaFisica(this.datosForm.getRawValue());
    datos[nodoId] = datosNodo;
    this.datosForm.patchValue(datosNodo as any, { emitEvent: false });
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
    this.aplicarTipoPersonaForzadaPorComercio(sucursalId);
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
    const comercioActual = this.comercioForm.getRawValue();
    comercio[nodoId] = {
      ...comercioActual,
      tipoComercioId: this.typeOfBusinessPayload(nodoId, comercioActual.tipoComercio, comercioActual.tipoComercioId),
    };
    this.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(comercio), { emitEvent: false });
    this.guardarTipoPersonaAutomaticoPorComercio(nodoId, comercioActual.tipoComercio);
  }

  private guardarTipoPersonaAutomaticoPorComercio(nodoId: string, tipoComercio: string): void {
    const tipoPersona = this.tipoPersonaForzadaPorTexto(tipoComercio);
    if (!tipoPersona) return;

    const datos = this.obtenerDatosPorSucursal();
    datos[nodoId] = {
      ...(datos[nodoId] ?? {}),
      tipoPersona,
    };
    this.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(datos), { emitEvent: false });

    if (this.arbolNegocioForm.controls.nodoSeleccionado.value === nodoId) {
      this.datosForm.controls.tipoPersona.setValue(tipoPersona, { emitEvent: false });
      this.actualizarValidadoresDatos();
    }
  }

  private guardarComercioAutomaticoComercioUnico(): void {
    if (!this.esComercioUnico) return;
    const comercio = this.obtenerComercioPorNodo();

    this.aplanarArbolNegocio(this.arbolNegocioWizard).forEach(nodo => {
      const nivel = this.nivelClientePorNodo(nodo);
      const tipoComercio = this.tipoComercioAutomaticoPorNodo(nodo);
      comercio[nodo.id] = {
        nivel,
        tipoComercio,
        tipoComercioId: this.typeOfBusinessPayload(nodo.id, tipoComercio),
        afiliacionComisionista: this.comercioForm.controls.afiliacionComisionista.value,
      };
    });

    this.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(comercio), { emitEvent: false });
  }

  private obtenerComercioPorNodo(): Record<string, { nivel: string; tipoComercio: string; tipoComercioId?: number; afiliacionComisionista: string }> {
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

  private tipoComercioAutomaticoPorNodo(nodo: NodoArbolNegocio): string {
    const tipoForzado = this.tipoComercioForzadoPorEntidad(nodo);
    if (tipoForzado) return tipoForzado;
    if (nodo.nivel === 'sub-afiliado') return 'Empresa Holding';
    if (!this.esComercioUnico) return '';
    return nodo.nivel === 'caja'
      ? 'Cuenta Terminal Pin Rapido'
      : this.tipoNegocioSeleccionado?.tipoComercio || 'Sucursales Únicas';
  }

  private esDescripcionComercioAutomatica(nodo: NodoArbolNegocio): boolean {
    const tipoComercio = this.tipoComercioAutomaticoPorNodo(nodo);
    const campos = this.datosGeneralesPorTipo[tipoComercio] ?? [];
    if (campos.includes('tipoPersona')) return false;
    return nodo.nivel === 'sub-afiliado' && tipoComercio === 'Empresa Holding';
  }

  private tipoComercioForzadoPorEntidad(nodo: NodoArbolNegocio): string {
    return '';
  }

  private tipoComercioEfectivoActual(): string {
    const nivel = this.comercioForm.getRawValue().nivel;
    if (['Referenciador', 'Comisionista'].includes(nivel)) return nivel;
    const nodoId = this.arbolNegocioForm.controls.nodoSeleccionado.value;
    const tipoNodo = nodoId ? this.obtenerComercioPorNodo()[nodoId]?.tipoComercio : '';
    if (tipoNodo) return this.valorTexto(tipoNodo);
    return this.valorTexto(this.comercioForm.getRawValue().tipoComercio);
  }

  private requiereRepresentantePorTipo(tipoComercio: string): boolean {
    if (this.tiposCaja.includes(tipoComercio)) return false;
    if (this.tiposSinRepresentante.includes(tipoComercio)) return false;
    return this.tiposConRepresentante.includes(tipoComercio);
  }

  private requiereDatosRepresentante(tipoComercio: string, tipoPersona: unknown): boolean {
    if (!this.requiereRepresentantePorTipo(tipoComercio)) return false;
    if (['Empresa Holding', 'Empresa Grupo', 'Sucursales de Grupo'].includes(tipoComercio) && this.tipoPersonaPayload(tipoPersona) === 'PF') return false;
    if (tipoComercio === 'Sucursales Únicas' && this.tipoPersonaPayload(tipoPersona) === 'PF') return false;
    return true;
  }

  private copiarInfoFiscalDesdeEntidad(): void {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const entidad = nodo ? this.buscarEntidadPadre(nodo.id) : undefined;
    if (!entidad) return;

    const datosEntidad = this.obtenerDatosPorSucursal()[entidad.id];
    if (!datosEntidad) return;
    const tipoPersonaEntidad = this.tipoPersonaPayload(datosEntidad['tipoPersona']);
    const tipoPersonaActual = this.tipoPersonaPayload(this.datosForm.controls.tipoPersona.value);
    const camposCopiables = tipoPersonaEntidad && tipoPersonaActual && tipoPersonaEntidad !== tipoPersonaActual
      ? this.camposInfoFiscalCompartidaPersona
      : this.camposInfoFiscalEntidad;

    const valores = Object.fromEntries(
      camposCopiables
        .filter(campo => typeof datosEntidad[campo] === 'boolean' || this.valorTexto(datosEntidad[campo]) || this.valorNumero(datosEntidad[campo]) > 0)
        .map(campo => [campo, datosEntidad[campo] ?? ''])
    );
    this.datosForm.patchValue(valores as any, { emitEvent: false });
    if (nodo) this.aplicarTipoPersonaForzadaPorComercio(nodo.id);
  }

  private limpiarInfoFiscalEntidad(): void {
    const valores = Object.fromEntries(
      this.camposInfoFiscalEntidad.filter(campo => campo !== 'tipoPersona').map(campo => {
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

  private esNodoSucursalActualConEntidad(): boolean {
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    return nodo?.nivel === 'sucursal' && !!this.buscarEntidadPadre(nodo.id);
  }

  private aplicarTipoPersonaForzadaPorComercio(nodoId: string): void {
    const tipoPersona = this.tipoPersonaForzadaPorComercio(nodoId);
    if (!tipoPersona) return;

    this.datosForm.controls.tipoPersona.setValue(tipoPersona, { emitEvent: false });
  }

  private aplicarTipoPersonaPorTipoComercio(tipoComercio: string): void {
    const tipoPersona = this.tipoPersonaForzadaPorTexto(tipoComercio);
    if (!tipoPersona) return;

    this.datosForm.controls.tipoPersona.setValue(tipoPersona, { emitEvent: false });
    this.actualizarValidadoresDatos();
  }

  private tipoPersonaForzadaPorComercio(nodoId: string): string {
    const nodo = this.buscarNodoArbol(nodoId);
    if (!nodo) return '';

    const comercio = this.obtenerComercioPorNodo();
    const esNodoActual = this.arbolNegocioForm.controls.nodoSeleccionado.value === nodo.id;
    const tipoComercio = this.valorTexto(
      this.tipoComercioForzadoPorEntidad(nodo)
      || comercio[nodo.id]?.tipoComercio
      || (esNodoActual ? this.comercioForm.controls.tipoComercio.value : '')
      || this.tipoComercioAutomaticoPorNodo(nodo)
    );

    return this.tipoPersonaForzadaPorTexto(tipoComercio);
  }

  private tipoPersonaForzadaPorTexto(tipoComercio: string): string {
    const tipo = tipoComercio.toLowerCase();
    if (tipo === 'empresa holding') return 'PM';
    if (tipo.includes('persona física') || tipo.includes('persona fisica')) return 'PF';

    return '';
  }

  private sincronizarRepresentanteDesdePersonaFisica(datos: Record<string, string | boolean>, tipoComercioActual?: string): Record<string, string | boolean> {
    if (`${datos['tipoPersona'] || ''}` !== 'PF') return datos;

    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const tipoComercio = this.valorTexto(
      tipoComercioActual
      || (nodo ? this.obtenerComercioPorNodo()[nodo.id]?.tipoComercio : '')
      || this.comercioForm.controls.tipoComercio.value
    );
    if (!this.requiereDatosRepresentante(tipoComercio, datos['tipoPersona']) && tipoComercio !== 'Persona Física') return datos;

    return {
      ...datos,
      nombreRepresentante: datos['nombre'] || '',
      apellidoPaternoRepresentante: datos['apellidoPaterno'] || '',
      apellidoMaternoRepresentante: datos['apellidoMaterno'] || '',
    };
  }

  private actualizarEstadoInfoFiscalEntidad(): void {
    const debeBloquear = this.mostrarInfoFiscalEntidadSucursal && this.datosForm.controls.mismaInfoFiscalEntidad.value;
    const nodo = this.buscarNodoArbol(this.arbolNegocioForm.controls.nodoSeleccionado.value);
    const entidad = nodo ? this.buscarEntidadPadre(nodo.id) : undefined;
    const datosEntidad = entidad ? this.obtenerDatosPorSucursal()[entidad.id] : undefined;

    const tipoPersonaEntidad = datosEntidad ? this.tipoPersonaPayload(datosEntidad['tipoPersona']) : '';
    const tipoPersonaActual = this.tipoPersonaPayload(this.datosForm.controls.tipoPersona.value);
    const camposBloqueables = tipoPersonaEntidad && tipoPersonaActual && tipoPersonaEntidad !== tipoPersonaActual
      ? new Set(this.camposInfoFiscalCompartidaPersona)
      : new Set(this.camposInfoFiscalEntidad);

    this.camposInfoFiscalEntidad.forEach(campo => {
      const control = this.datosForm.get(campo);
      if (!control) return;
      const entidadTieneValor = !!datosEntidad && !!this.valorTexto(datosEntidad[campo]);
      if (campo === 'tipoPersona' && this.tipoPersonaForzadaPorTexto(this.tipoComercioEfectivoActual())) {
        control.disable({ emitEvent: false });
      } else if (debeBloquear && camposBloqueables.has(campo) && entidadTieneValor) {
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
    const nodoId = this.nodoDocumentosActualId();
    this.documentosPorNodo[nodoId] = Object.fromEntries(
      this.documentosVisibles.map(documento => [documento.numero, {
        archivo: documento.archivo,
        archivoNombre: documento.archivoNombre,
      }])
    );
  }

  private guardarDocumentoNodoActual(documento: DocumentoRequerido): void {
    const nodoId = this.nodoDocumentosActualId();
    this.documentosPorNodo[nodoId] = {
      ...(this.documentosPorNodo[nodoId] ?? {}),
      [documento.numero]: {
        archivo: documento.archivo,
        archivoNombre: documento.archivoNombre,
      },
    };
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

  private nodoDocumentosActualId(): string {
    if (!this.mostrarArbolWizard) return 'preregistro';
    return this.arbolNegocioForm.controls.nodoSeleccionado.value
      || this.primerNodoCapturableArbol()?.id
      || 'sucursal-1';
  }

  private avanzarASiguienteSucursal(): boolean {
    const nodos = this.nodosCapturablesParaFlujo();
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

  private retrocederANodoAnteriorArbol(): boolean {
    const nodos = this.nodosCapturablesParaFlujo();
    const actualId = this.arbolNegocioForm.controls.nodoSeleccionado.value || nodos[0]?.id || 'sucursal-1';
    const actualIndex = nodos.findIndex(nodo => nodo.id === actualId);
    const anterior = nodos[actualIndex - 1];
    if (!anterior) return false;

    this.arbolNegocioForm.patchValue({
      ubicacionSeleccionada: anterior.ruta,
      nivelSeleccionado: anterior.nivel,
      nodoSeleccionado: anterior.id,
    }, { emitEvent: false });
    this.cargarDatosSucursal(anterior.id);
    this.cargarAccesosNodo(anterior.id);
    this.cargarDocumentosNodo(anterior.id);
    this.aplicarComercioPorNodo(anterior);
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
    this.localidadesComercial = [...this.localidadesFiscal];
    this.cargandoLocalidadesComercial = false;

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
      locationIDComercial: datos.locationID,
      entreCalleComercial: datos.entreCalle,
      yCalleComercial: datos.yCalle

    }, { emitEvent: false });

  }

  private limpiarDomicilioComercial(): void {
    this.localidadesComercial = [];
    this.cargandoLocalidadesComercial = false;

    this.datosForm.patchValue({
      codigoPostalComercial: '',
      tipoVialidadComercial: '',
      nombreVialidadComercial: '',
      numeroExteriorComercial: '',
      numeroInteriorComercial: '',
      coloniaComercial: '',
      localidadComercial: '',
      municipioComercial: '',
      entidadFederativaComercial: '',
      locationIDComercial: '',
      entreCalleComercial: '',
      yCalleComercial: '',
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

  private rfcValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      if (valor.length < 12 || valor.length > 13) return { rfcInvalido: true };
      return /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/.test(valor) ? null : { rfcInvalido: true };
    };
  }

  private curpValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      if (valor.length !== 18) return { curpInvalida: true };
      const patron = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;
      return patron.test(valor) ? null : { curpInvalida: true };
    };
  }

  private validadoresDatosPorCampo(nombre: string, requerido: boolean): ValidatorFn[] {
    const validadores: ValidatorFn[] = requerido ? [Validators.required] : [];
    const telefonoPattern = /^\d{10}$/;
    const codigoPostalPattern = /^\d{5}$/;

    if (['rfc'].includes(nombre)) validadores.push(Validators.maxLength(13), this.rfcValidator());
    if (['curp'].includes(nombre)) validadores.push(Validators.minLength(18), Validators.maxLength(18), this.curpValidator());
    if (['correo', 'correoComercial', 'correoRepresentante'].includes(nombre)) validadores.push(Validators.email, this.emailValidator);
    if (['telefono', 'telefonoComercial', 'telefonoRepresentante', 'telefonoAdicionalComercial', 'telefonoAdicionalRepresentante'].includes(nombre)) {
      validadores.push(Validators.minLength(10), Validators.maxLength(10), Validators.pattern(telefonoPattern));
    }
    if (['codigoPostal', 'codigoPostalComercial', 'codigoPostalRepresentante'].includes(nombre)) {
      validadores.push(Validators.minLength(5), Validators.maxLength(5), Validators.pattern(codigoPostalPattern));
    }

    return validadores;
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
    this.setValidators(this.liquidacionForm.controls.rfcBeneficiario, [Validators.required, Validators.maxLength(13), this.rfcValidator()]);
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
