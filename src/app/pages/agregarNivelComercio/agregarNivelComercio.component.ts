import { getSessionRole } from '../../shared/services/session-role';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, forkJoin, map, of, timeout } from 'rxjs';
import { ConsultaComercioApi, ConsultaComerciosService } from '../../services/consulta-comercios.service';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';
import { DocumentoRequerido } from '../preRegistro/models/preregistro.models';
import { StepDatosComponent } from '../preRegistro/components/datos-generales/step-datos.component';
import { CodigoPostalLocalizacion, LocalidadesService } from '../../services/localidades.service';
import { StepComercioComponent } from '../preRegistro/components/comercio/step-comercio.component';
import { PreRegistroService, TipoComercioCatalogo } from '../../services/preregistro.service';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { ActivatedRoute } from '@angular/router';
import { ArbolNodoApi, ArbolNodosService } from '../../services/arbol-nodos.service';
import { AgregarNivelComercioService, AltaNivelComercioPayload } from '../../services/agregar-nivel-comercio.service';
import { DocumentoPreregistroUpload, PreregistroDocumentosService } from '../../services/preregistro-documentos.service';

type NivelComercio = 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja';
type NivelNuevo = 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja' | 'Referenciador';

interface NodoComercio {
  id: string;
  llave: string;
  nombre: string;
  nivel: NivelComercio;
  nodeID?: string;
  entitySonID?: string;
  hijos: NodoComercio[];
}

@Component({
  selector: 'app-agregar-nivel-comercio',
  standalone: true,
  imports: [ProcessingOverlayComponent, CommonModule, FormsModule, ReactiveFormsModule, StepComercioComponent, StepDatosComponent, StepDocumentosComponent],
  templateUrl: './agregarNivelComercio.component.html',
  styleUrls: ['./agregarNivelComercio.component.css']
})
export class AgregarNivelComercioComponent implements OnInit {
  @ViewChild('inicioRegistro', { static: true }) private inicioRegistro!: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly consultaComerciosService = inject(ConsultaComerciosService);
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly regimenFiscalService = inject(RegimenFiscalService);
  private readonly localidadesService = inject(LocalidadesService);
  private readonly arbolNodosService = inject(ArbolNodosService);
  private readonly agregarNivelComercioService = inject(AgregarNivelComercioService);
  private readonly preregistroDocumentosService = inject(PreregistroDocumentosService);
  private readonly route = inject(ActivatedRoute);

  readonly idRol = getSessionRole();
  cargando = false;
  enviando = false;
  mensaje = '';
  modalRegistro = { visible: false, tipo: 'success' as 'success' | 'error', titulo: '', mensaje: '' };
  arbol: NodoComercio[] = [];
  nodoSeleccionado?: NodoComercio;
  nodoSeleccionadoId = '';
  busquedaComercio = '';
  nivelNuevo: NivelNuevo | '' = '';
  paso: 1 | 2 | 3 | 4 = 1;
  enviado = false;
  nodosColapsados = new Set<string>();
  arbolMinimizado = false;
  cargandoArbol = false;
  errorArbol = '';
  localidadesFiscal: CodigoPostalLocalizacion[] = [];
  localidadesComercial: CodigoPostalLocalizacion[] = [];
  localidadesRepresentante: CodigoPostalLocalizacion[] = [];
  cargandoLocalidadesFiscal = false;
  cargandoLocalidadesComercial = false;
  cargandoLocalidadesRepresentante = false;
  readonly datosGeneralesPorTipo: Record<string, string[]> = {
    'Empresa Grupo': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Persona Física': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Sucursales de Grupo': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Sucursal Persona Física': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Sucursales Únicas': ['tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Caja con Tarjeta sólo Fondeo': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Caja con Tarjeta SPEI': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Cuenta Entidad': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Cuenta Terminal': ['tipoPersona', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'nombreComercial', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc', 'rfc', 'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'],
    'Cuenta Terminal Pin Rapido': []
  };
  readonly datosCatalogo = {
    regimenesFiscales: [] as string[],
    girosComerciales: [],
    tiposPersona: ['PF', 'PM'],
    departamentos: [],
    ciudades: []
  };

  readonly tiposComercioPorNivel: Record<NivelNuevo, string[]> = {
    'Sub Afiliado': [],
    Entidad: ['Empresa Grupo', 'Persona Física'],
    Sucursal: ['Sucursales de Grupo', 'Sucursal Persona Física', 'Sucursales Únicas'],
    Caja: ['Caja con Tarjeta sólo Fondeo', 'Caja con Tarjeta SPEI', 'Cuenta Entidad', 'Cuenta Terminal', 'Cuenta Terminal Pin Rapido'],
    Referenciador: ['Referenciador con Operación', 'Referenciador Administrador']
  };
  private readonly typeOfBusinessFallbackPorTipoComercio: Record<string, number> = {
    'Empresa Grupo': 16,
    'Persona Física': 17,
    'Sucursales de Grupo': 18,
    'Sucursal Persona Física': 19,
    'Sucursales Únicas': 20,
    'Caja con Tarjeta sólo Fondeo': 11,
    'Caja con Tarjeta SPEI': 12,
    'Cuenta Entidad': 14,
    'Cuenta Terminal': 13,
    'Cuenta Terminal Pin Rapido': 13,
    'Referenciador con Operación': 14,
    'Referenciador Administrador': 15
  };
  private typeOfBusinessPorTipoComercio: Record<string, number> = {};
  private tiposComercioCatalogoPorNivel: Record<string, Array<{ id: number; nombre: string }>> = {};
  private tiposComercioCatalogoSolicitados = new Set<string>();

  private readonly camposReferenciador = [
    'tipoPersona', 'rfc', 'razonSocial', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp',
    'nombreComercial', 'regimenFiscal', 'actividad', 'giroComercial', 'descripcionGiro', 'mcc',
    'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior',
    'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle',
    'yCalle', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial',
    'numeroExteriorComercial', 'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial',
    'municipioComercial', 'entidadFederativaComercial', 'entreCalleComercial', 'yCalleComercial',
    'correoComercial', 'telefonoComercial', 'telefonoAdicionalComercial'
  ];

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    tipoComercioId: [0],
    nombreCaja: ['', Validators.required],
    afiliacionComisionista: ['']
  });

  readonly datosForm = this.fb.nonNullable.group({
    tipoPersona: ['PM', Validators.required],
    razonSocial: ['', Validators.required],
    nombre: [''],
    apellidoPaterno: [''],
    apellidoMaterno: [''],
    curp: [''],
    nombreComercial: ['', Validators.required],
    rfc: ['', Validators.required],
    regimenFiscal: [''],
    actividad: [''],
    actividadId: [''],
    giroComercial: [''],
    descripcionGiro: [''],
    mcc: [''],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    tipoVialidad: [''],
    nombreVialidad: ['', Validators.required],
    numeroExterior: ['', Validators.required],
    numeroInterior: [''],
    colonia: ['', Validators.required],
    localidad: [''],
    municipio: ['', Validators.required],
    entidadFederativa: ['', Validators.required],
    entreCalle: [''],
    yCalle: [''],
    nombreRepresentante: [''],
    apellidoPaternoRepresentante: [''],
    apellidoMaternoRepresentante: [''],
    calleRepresentante: [''],
    numeroExteriorRepresentante: [''],
    numeroInteriorRepresentante: [''],
    codigoPostalRepresentante: [''],
    coloniaRepresentante: [''],
    municipioRepresentante: [''],
    estadoRepresentante: [''],
    locationIDRepresentante: [''],
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

  documentos: DocumentoRequerido[] = [
    { numero: 1, nombre: 'Comprobante de domicilio', obligatorio: true },
    { numero: 2, nombre: 'Acta Constitutiva', obligatorio: true },
    { numero: 3, nombre: 'Identificación Oficial del Propietario', obligatorio: true },
    { numero: 4, nombre: 'Contrato', obligatorio: false },
    { numero: 5, nombre: 'Imagen Frente', obligatorio: false },
    { numero: 6, nombre: 'Imagen Interior', obligatorio: false },
    { numero: 7, nombre: 'Imagen Interior 2 del comercio', obligatorio: false },
    { numero: 8, nombre: 'Escrituras Públicas', obligatorio: false },
    { numero: 9, nombre: 'Poder del Representante', obligatorio: false },
    { numero: 10, nombre: 'Constancia Situacion Fiscal', obligatorio: true },
    { numero: 11, nombre: 'E-Firma', obligatorio: false },
    { numero: 12, nombre: 'Identificación Oficial del Representante Legal', obligatorio: false },
    { numero: 13, nombre: 'Identificación Oficial de un tercero', obligatorio: false },
  ];

  private readonly documentosPersonaFisica: DocumentoRequerido[] = [
    { numero: 1, nombre: 'Comprobante de domicilio', obligatorio: true },
    { numero: 2, nombre: 'Identificación Oficial', obligatorio: true },
    { numero: 3, nombre: 'Contrato', obligatorio: false },
    { numero: 4, nombre: 'Imagen Frente', obligatorio: true },
    { numero: 5, nombre: 'Imagen Interior', obligatorio: true },
    { numero: 6, nombre: 'Imagen Interior 2 del comercio', obligatorio: true },
    { numero: 7, nombre: 'Constancia Situacion Fiscal', obligatorio: true },
    { numero: 8, nombre: 'E-Firma', obligatorio: false },
  ];

  private readonly documentosCapturados: Record<string, Pick<DocumentoRequerido, 'archivo' | 'archivoNombre'>> = {};

  ngOnInit(): void {
    this.cargarArbolInicial();
    this.cargarRegimenesFiscales();
    this.comercioForm.controls.tipoComercio.valueChanges.subscribe(tipoComercio => {
      this.comercioForm.controls.tipoComercioId.setValue(this.typeOfBusinessPayload(tipoComercio), { emitEvent: false });
      this.aplicarTipoPersonaPorTipoComercio(tipoComercio);
      this.actualizarValidadoresDatos();
    });
    this.datosForm.controls.tipoPersona.valueChanges.subscribe(() => this.actualizarValidadoresDatos());
    this.datosForm.controls.mismoDomicilio.valueChanges.subscribe(mismoDomicilio => {
      if (mismoDomicilio) {
        this.copiarDomicilioFiscal();
      } else {
        this.limpiarDomicilioComercial();
      }
      this.actualizarValidadoresDatos();
    });
    this.datosForm.controls.codigoPostal.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'DF'));
    this.datosForm.controls.codigoPostalComercial.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'DC'));
    this.datosForm.controls.codigoPostalRepresentante.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(codigoPostal => this.consultarLocalidadesPorCodigoPostal(codigoPostal, 'REP'));
    this.actualizarValidadoresDatos();
  }

  private cargarRegimenesFiscales(): void {
    this.regimenFiscalService.getAllOptions().subscribe({
      next: regimenes => {
        this.datosCatalogo.regimenesFiscales = regimenes;
      },
      error: () => {
        this.datosCatalogo.regimenesFiscales = [];
      }
    });
  }

  get nivelesDisponibles(): NivelNuevo[] {
    if (!this.nodoSeleccionado) return [];
    return this.nivelesDisponiblesPara(this.nodoSeleccionado);
  }

  get puedeContinuarSeleccion(): boolean {
    return !!this.nodoSeleccionado && !!this.nivelNuevo
      && this.nivelesDisponibles.includes(this.nivelNuevo);
  }

  get esCajaSeleccionada(): boolean {
    return this.nivelNuevo === 'Caja';
  }

  get esCajaPinRapido(): boolean {
    return this.esCajaSeleccionada && this.comercioForm.controls.tipoComercio.value === 'Cuenta Terminal Pin Rapido';
  }

  get tiposComercio(): string[] {
    if (!this.nivelNuevo) return [];
    const catalogo = this.tiposComercioCatalogoPorNivel[this.nivelNuevo]?.map(tipo => tipo.nombre) ?? [];
    const base = catalogo.length ? catalogo : this.tiposComercioPorNivel[this.nivelNuevo] ?? [];
    if (this.nivelNuevo === 'Referenciador') {
      const opcionesReferenciador = ['Referenciador con Operación', 'Referenciador Administrador'];
      return opcionesReferenciador.filter(opcion => base.includes(opcion));
    }
    if (this.nivelNuevo === 'Sub Afiliado') return catalogo;
    const permitidos = this.tiposComercioPorNivel[this.nivelNuevo] ?? [];
    return base.filter(tipo => permitidos.includes(tipo));
  }

  get tipoComercioSeleccionado(): string {
    return this.comercioForm.getRawValue().tipoComercio
      || (this.nivelNuevo === 'Entidad' ? 'Empresa Grupo' : this.nivelNuevo === 'Caja' ? 'Cuenta Terminal' : 'Sucursales de Grupo');
  }

  get camposDatosGenerales(): string[] {
    if (this.nivelNuevo === 'Referenciador' || this.nivelNuevo === 'Sub Afiliado') {
      return this.camposReferenciador;
    }
    return this.datosGeneralesPorTipo[this.tipoComercioSeleccionado] ?? [];
  }

  get comerciosDisponibles(): NodoComercio[] {
    return this.aplanarNodos(this.arbol).filter(nodo => this.nivelesDisponiblesPara(nodo).length > 0);
  }

  get documentosCargados(): number {
    return this.documentosVisibles.filter(documento => !!(documento.archivo || documento.archivoNombre)).length;
  }

  get documentosPendientes(): number {
    return this.documentosVisibles.filter(documento => documento.obligatorio && !documento.archivo && !documento.archivoNombre).length;
  }

  get documentosVisibles(): DocumentoRequerido[] {
    const tipoPersona = this.datosForm.controls.tipoPersona.value === 'PF' ? 'PF' : 'PM';
    const documentosBase = tipoPersona === 'PF' ? this.documentosPersonaFisica : this.documentos;

    return documentosBase.map(documento => {
      const guardado = this.documentosCapturados[this.llaveDocumento(documento)];
      return {
        ...documento,
        archivo: guardado?.archivo,
        archivoNombre: guardado?.archivoNombre,
      };
    });
  }

  nodoExpandido(id: string): boolean {
    return !this.nodosColapsados.has(id);
  }

  alternarNodo(id: string): void {
    this.nodosColapsados.has(id) ? this.nodosColapsados.delete(id) : this.nodosColapsados.add(id);
  }

  esNodoSeleccionado(nodo: NodoComercio): boolean {
    return this.nodoSeleccionado?.id === nodo.id;
  }

  etiquetaNodo(nodo: NodoComercio): string {
    return `${nodo.nivel} - ${nodo.nombre}`;
  }

  iconoNodo(nivel: NivelComercio): string {
    if (nivel === 'Caja') return 'fa-solid fa-cash-register';
    return 'fa-solid fa-folder';
  }

  rutaSeleccionada(): string {
    return this.nodoSeleccionado ? this.etiquetaNodo(this.nodoSeleccionado) : 'Selecciona un nodo';
  }

  cargarArbolInicial(): void {
    const nodeID = this.route.snapshot.queryParamMap.get('nodeID') || this.route.snapshot.queryParamMap.get('nodeId');
    if (nodeID) {
      this.cargarArbolPorNodeID(nodeID);
      return;
    }

    this.cargando = true;
    this.mensaje = '';
    this.consultaComerciosService.buscarComercios({})
      .pipe(timeout(45000))
      .subscribe({
        next: respuesta => {
          const comercioRaiz = (respuesta.commerces ?? []).find(comercio => !this.esPendienteRevision(comercio) && (comercio.nodeID || comercio.contextID));
          const raizNodeID = comercioRaiz?.nodeID || comercioRaiz?.contextID;
          this.cargando = false;
          if (raizNodeID) {
            this.cargarArbolPorNodeID(raizNodeID, respuesta.commerces ?? []);
            return;
          }
          this.arbol = this.construirArbol(respuesta.commerces ?? []);
          if (!this.arbol.length) this.mensaje = 'No se encontraron comercios para agregar niveles.';
        },
        error: () => {
          this.mensaje = 'No fue posible consultar el comercio inicial.';
          this.cargando = false;
        }
      });
  }

  cargarArbolPorNodeID(nodeID: string | number, comercios?: ConsultaComercioApi[]): void {
    this.cargandoArbol = true;
    this.errorArbol = '';
    forkJoin({
      arbol: this.arbolNodosService.obtenerArbol(nodeID),
      comercios: comercios ? of(comercios) : this.consultaComerciosService.buscarComercios({}).pipe(
        map(respuesta => {
          if (respuesta.success === false) throw new Error('No se pudo verificar el estatus de los comercios.');
          return respuesta.commerces ?? [];
        })
      )
    }).pipe(timeout(45000))
      .subscribe({
        next: respuesta => {
          this.arbol = this.excluirPendientesDelArbol(this.nodosDesdeArbolApi(respuesta.arbol), respuesta.comercios);
          this.cargandoArbol = false;
          if (!this.arbol.length) this.errorArbol = 'No se encontraron nodos para este comercio.';
        },
        error: () => {
          this.cargandoArbol = false;
          this.errorArbol = 'No fue posible cargar el árbol del comercio.';
        }
      });
  }

  cargarComercios(): void {
    this.cargando = true;
    this.mensaje = '';

    this.consultaComerciosService.buscarComercios({})
      .pipe(timeout(45000))
      .subscribe({
      next: respuesta => {
        this.arbol = this.construirArbol(respuesta.commerces ?? []);
        if (!this.arbol.length) this.mensaje = 'No se encontraron comercios para agregar niveles.';
        this.cargando = false;
      },
      error: () => {
        this.mensaje = 'No fue posible consultar los comercios existentes.';
        this.cargando = false;
      }
    });
  }

  seleccionarNodo(nodo: NodoComercio): void {
    this.nodoSeleccionado = nodo;
    this.nodoSeleccionadoId = nodo.id;
    this.paso = 1;
    this.nivelNuevo = '';
    this.comercioForm.reset();
    this.datosForm.reset();
    this.localidadesFiscal = [];
    this.localidadesComercial = [];
    this.localidadesRepresentante = [];
  }

  seleccionarNodoPorId(id: string): void {
    const nodo = this.aplanarNodos(this.arbol).find(item => item.id === id);
    if (nodo) this.seleccionarNodo(nodo);
  }

  continuarADatos(): void {
    if (!this.puedeContinuarSeleccion) return;
    this.actualizarValidadorNombreCaja();
    this.cargarTiposComercioCatalogo(this.nivelNuevo);
    const tipos = this.tiposComercio;
    const tipoActual = this.comercioForm.controls.tipoComercio.value;
    const esTipoEspecial = this.nivelNuevo === 'Referenciador';
    const tipoComercio = esTipoEspecial
      ? tipoActual && tipos.includes(tipoActual) ? tipoActual : ''
      : tipoActual && tipos.includes(tipoActual) ? tipoActual : tipos.length === 1 ? tipos[0] : '';
    this.comercioForm.patchValue({
      nivel: this.nivelNuevo,
      tipoComercio,
      tipoComercioId: this.typeOfBusinessPayload(tipoComercio)
    });
    this.aplicarTipoPersonaPorTipoComercio(this.comercioForm.getRawValue().tipoComercio);
    this.paso = 2;
  }

  continuarDescripcion(): void {
    if (this.esCajaPinRapido) {
      this.guardarCaja();
      return;
    }

    if (this.comercioForm.invalid) {
      this.comercioForm.markAllAsTouched();
      return;
    }
    if (this.esCajaSeleccionada) {
      this.datosForm.controls.nombreComercial.setValue(this.comercioForm.controls.nombreCaja.value.trim());
    }
    this.paso = 3;
  }

  private actualizarValidadorNombreCaja(): void {
    const control = this.comercioForm.controls.nombreCaja;
    if (this.esCajaSeleccionada) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarValidadoresDatos(): void {
    const activos = new Set(this.camposDatosGenerales);
    const esPersonaFisica = this.datosForm.controls.tipoPersona.value === 'PF';
    const esPersonaMoral = this.datosForm.controls.tipoPersona.value === 'PM';

    Object.keys(this.datosForm.controls).forEach(nombre => {
      const control = this.datosForm.get(nombre);
      if (!control) return;

      const esCampoActivo = activos.has(nombre);
      const camposCondicionales = ['actividad', 'actividadId', 'giroComercial', 'descripcionGiro', 'mcc'];
      const camposOpcionales = [
        'numeroInterior', 'entreCalle', 'yCalle',
        'numeroInteriorComercial', 'entreCalleComercial', 'yCalleComercial',
        'numeroInteriorRepresentante', 'entreCalleRepresentante', 'yCalleRepresentante',
        'telefonoAdicionalComercial', 'telefonoAdicionalRepresentante'
      ];
      const mostrarRepresentante = this.mostrarDireccionRepresentante();
      const camposRepresentanteObligatorios = [
        'calleRepresentante', 'numeroExteriorRepresentante', 'codigoPostalRepresentante',
        'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante'
      ];
      const camposPersonaFisica = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'actividad', 'actividadId'];
      const camposPersonaMoral = ['razonSocial', 'giroComercial', 'descripcionGiro', 'mcc'];
      const campoVisiblePorPersona = !camposPersonaFisica.includes(nombre) || esPersonaFisica;
      const campoMoralVisible = !camposPersonaMoral.includes(nombre) || esPersonaMoral;
      const obligatorio = (esCampoActivo
        && !camposCondicionales.includes(nombre)
        && !camposOpcionales.includes(nombre)
        && campoVisiblePorPersona
        && campoMoralVisible
        || (esPersonaFisica && ['actividad', 'actividadId'].includes(nombre) && esCampoActivo)
        || (esPersonaMoral && ['giroComercial', 'descripcionGiro', 'mcc'].includes(nombre) && esCampoActivo)
        || (mostrarRepresentante && camposRepresentanteObligatorios.includes(nombre)));
      const validadores = this.validadoresDatosPorCampo(nombre, obligatorio);

      if (['nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp'].includes(nombre) && !esPersonaFisica) {
        control.setValue('', { emitEvent: false });
      }
      if (nombre === 'razonSocial' && !esPersonaMoral) {
        control.setValue('', { emitEvent: false });
      }
      control.setValidators(validadores);
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private mostrarDireccionRepresentante(): boolean {
    const tiposConRepresentante = [
      'Empresa Grupo', 'Sucursales de Grupo', 'Sucursales Únicas', 'Empresa Agrupadora', 'Entidad Agrupadora'
    ];
    return this.datosForm.controls.tipoPersona.value === 'PM'
      && (this.nivelNuevo === 'Sub Afiliado' || tiposConRepresentante.includes(this.tipoComercioSeleccionado));
  }

  private validadoresDatosPorCampo(nombre: string, requerido: boolean): ValidatorFn[] {
    const validadores: ValidatorFn[] = requerido ? [Validators.required] : [];
    if (nombre === 'rfc') {
      const longitudRfc = this.datosForm.controls.tipoPersona.value === 'PM' ? 12 : 13;
      validadores.push(Validators.maxLength(longitudRfc), this.rfcValidator());
    }
    if (nombre === 'curp') validadores.push(Validators.minLength(18), Validators.maxLength(18), this.curpValidator());
    if (['correo', 'correoComercial'].includes(nombre)) {
      validadores.push(Validators.email, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
    }
    if (['telefono', 'telefonoComercial', 'telefonoAdicionalComercial'].includes(nombre)) {
      validadores.push(Validators.minLength(10), Validators.maxLength(10), Validators.pattern(/^\d{10}$/));
    }
    if (['codigoPostal', 'codigoPostalComercial'].includes(nombre)) {
      validadores.push(Validators.minLength(5), Validators.maxLength(5), Validators.pattern(/^\d{5}$/));
    }
    return validadores;
  }

  private rfcValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      return /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/.test(valor) ? null : { rfcInvalido: true };
    };
  }

  private curpValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      const patron = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;
      return patron.test(valor) ? null : { curpInvalida: true };
    };
  }

  guardarCaja(): void {
    if (this.enviando || this.enviado || !this.puedeContinuarSeleccion) return;
    const nombreControl = this.comercioForm.controls.nombreCaja;
    const tipoControl = this.comercioForm.controls.tipoComercio;
    nombreControl.markAsTouched();
    tipoControl.markAsTouched();
    if (nombreControl.invalid || tipoControl.invalid || !this.nodoSeleccionado) return;

    if (!this.esCajaPinRapido) {
      this.datosForm.controls.tipoPersona.setValue('PF', { emitEvent: false });
      this.datosForm.controls.nombreComercial.setValue(nombreControl.value.trim());
      this.actualizarValidadoresDatos();
      this.paso = 3;
      return;
    }

    const payload = this.construirPayloadCaja();

    this.enviando = true;
    this.mensaje = '';
    this.agregarNivelComercioService.crearCaja(payload).subscribe({
      next: () => {
        this.enviando = false;
        this.enviado = true;
        this.mensaje = `Caja "${nombreControl.value.trim()}" agregada correctamente a ${this.nodoSeleccionado?.nombre}.`;
        this.mostrarModalRegistro('success', this.mensaje);
      },
      error: () => {
        this.enviando = false;
        this.mensaje = 'No fue posible agregar la caja.';
        this.mostrarModalRegistro('error', this.mensaje);
      }
    });
  }

  continuarADocumentos(): void {
    if (this.enviando || this.enviado || !this.puedeContinuarSeleccion) return;
    if (this.datosForm.invalid) {
      this.datosForm.markAllAsTouched();
      return;
    }
    if (this.esCajaSeleccionada) {
      this.enviarCajaNormal();
      return;
    }
    this.paso = 4;
  }

  private enviarCajaNormal(): void {
    if (!this.nodoSeleccionado) return;
    this.enviando = true;
    this.mensaje = '';
    this.agregarNivelComercioService.crearCaja(this.construirPayloadAlta()).subscribe({
      next: () => {
        this.enviando = false;
        this.enviado = true;
        this.mensaje = `Caja "${this.comercioForm.controls.nombreCaja.value.trim()}" agregada correctamente a ${this.nodoSeleccionado?.nombre}.`;
        this.mostrarModalRegistro('success', this.mensaje);
      },
      error: () => {
        this.enviando = false;
        this.mensaje = 'No fue posible agregar la caja.';
        this.mostrarModalRegistro('error', this.mensaje);
      }
    });
  }

  seleccionarLocalidad(_: string, __: 'DF' | 'DC' | 'REP'): void {
    const addressType = __;
    const localidades = addressType === 'DF' ? this.localidadesFiscal : this.localidadesComercial;
    const localidad = localidades.find(item => String(item.idLocalidad ?? item.locationID ?? '') === String(_));
    if (!localidad) return;

    if (addressType === 'DF') {
      this.datosForm.patchValue({
        colonia: localidad.colonia ?? localidad.district ?? '',
        localidad: localidad.municipio ?? localidad.location ?? '',
        municipio: localidad.municipio ?? localidad.municipality ?? '',
        entidadFederativa: localidad.estado ?? localidad.federativeEntity ?? '',
      }, { emitEvent: false });
      return;
    }

    if (addressType === 'REP') {
      this.datosForm.patchValue({
        coloniaRepresentante: localidad.colonia ?? localidad.district ?? '',
        municipioRepresentante: localidad.municipio ?? localidad.municipality ?? localidad.location ?? '',
        estadoRepresentante: localidad.estado ?? localidad.federativeEntity ?? '',
        locationIDRepresentante: localidad.idLocalidad ?? localidad.locationID ?? '',
      }, { emitEvent: false });
      return;
    }

    this.datosForm.patchValue({
      coloniaComercial: localidad.colonia ?? localidad.district ?? '',
      localidadComercial: localidad.municipio ?? localidad.location ?? '',
      municipioComercial: localidad.municipio ?? localidad.municipality ?? '',
      entidadFederativaComercial: localidad.estado ?? localidad.federativeEntity ?? '',
    }, { emitEvent: false });
  }

  private consultarLocalidadesPorCodigoPostal(codigoPostal: string, addressType: 'DF' | 'DC' | 'REP'): void {
    const cp = String(codigoPostal ?? '').trim();
    const esFiscal = addressType === 'DF';
    const esRepresentante = addressType === 'REP';
    if (!/^\d{5}$/.test(cp)) {
      if (esFiscal) this.localidadesFiscal = [];
      else if (esRepresentante) this.localidadesRepresentante = [];
      else this.localidadesComercial = [];
      if (esFiscal) this.cargandoLocalidadesFiscal = false;
      else if (esRepresentante) this.cargandoLocalidadesRepresentante = false;
      else this.cargandoLocalidadesComercial = false;
      return;
    }

    if (esFiscal) this.cargandoLocalidadesFiscal = true;
    else if (esRepresentante) this.cargandoLocalidadesRepresentante = true;
    else this.cargandoLocalidadesComercial = true;

    this.localidadesService.obtenerPorCodigoPostal(cp).subscribe({
      next: localidades => {
        if (esFiscal) {
          this.localidadesFiscal = localidades;
          this.cargandoLocalidadesFiscal = false;
        } else if (esRepresentante) {
          this.localidadesRepresentante = localidades;
          this.cargandoLocalidadesRepresentante = false;
        } else {
          this.localidadesComercial = localidades;
          this.cargandoLocalidadesComercial = false;
        }

        const primera = localidades[0];
        if (!primera) return;
        const municipio = primera.municipio ?? primera.municipality ?? primera.location ?? '';
        const estado = primera.estado ?? primera.federativeEntity ?? '';
        if (esFiscal) {
          this.datosForm.patchValue({ localidad: municipio, municipio, entidadFederativa: estado }, { emitEvent: false });
        } else if (esRepresentante) {
          this.datosForm.patchValue({ municipioRepresentante: municipio, estadoRepresentante: estado }, { emitEvent: false });
        } else {
          this.datosForm.patchValue({ localidadComercial: municipio, municipioComercial: municipio, entidadFederativaComercial: estado }, { emitEvent: false });
        }
      },
      error: () => {
        if (esFiscal) {
          this.localidadesFiscal = [];
          this.cargandoLocalidadesFiscal = false;
        } else if (esRepresentante) {
          this.localidadesRepresentante = [];
          this.cargandoLocalidadesRepresentante = false;
        } else {
          this.localidadesComercial = [];
          this.cargandoLocalidadesComercial = false;
        }
      }
    });
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
      entreCalleComercial: datos.entreCalle,
      yCalleComercial: datos.yCalle,
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
      entreCalleComercial: '',
      yCalleComercial: '',
    }, { emitEvent: false });
  }

  seleccionarArchivo(event: Event, documento: DocumentoRequerido): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    this.documentosCapturados[this.llaveDocumento(documento)] = {
      archivo,
      archivoNombre: archivo?.name,
    };
  }

  finalizar(): void {
    if (this.enviando || this.enviado || !this.puedeContinuarSeleccion) return;
    if (this.documentosPendientes > 0) {
      this.mensaje = 'Carga todos los documentos obligatorios antes de finalizar.';
      return;
    }
    if (!this.nivelNuevo || !this.nodoSeleccionado) return;
    if (this.nivelNuevo === 'Referenciador') {
      this.mensaje = 'Por ahora no hay endpoint configurado para agregar Referenciador.';
      return;
    }

    this.enviando = true;
    this.mensaje = '';
    this.agregarNivelComercioService.crearPorNivel(this.nivelNuevo, this.construirPayloadAlta()).subscribe({
      next: response => {
        const documentos = this.prepararDocumentosParaSubida(response);
        this.preregistroDocumentosService.subirDocumentos(documentos).subscribe({
          next: () => {
            this.enviando = false;
            this.enviado = true;
            this.mensaje = `${this.nivelNuevo} agregado correctamente a ${this.nodoSeleccionado?.nombre}.`;
            this.mostrarModalRegistro('success', this.mensaje);
          },
          error: () => {
            this.enviando = false;
            this.mensaje = `${this.nivelNuevo} se creó, pero no fue posible subir la documentación.`;
            this.mostrarModalRegistro('error', this.mensaje);
          }
        });
      },
      error: () => {
        this.enviando = false;
        this.mensaje = `No fue posible agregar ${this.nivelNuevo}.`;
        this.mostrarModalRegistro('error', this.mensaje);
      }
    });
  }

  cerrarModalRegistro(): void {
    const registroExitoso = this.modalRegistro.tipo === 'success' && this.enviado;
    this.modalRegistro.visible = false;
    if (!registroExitoso) return;

    this.paso = 1;
    this.nivelNuevo = '';
    this.nodoSeleccionado = undefined;
    this.nodoSeleccionadoId = '';
    this.busquedaComercio = '';
    this.arbolMinimizado = false;
    this.comercioForm.reset();
    this.datosForm.reset();
    for (const llave of Object.keys(this.documentosCapturados)) {
      delete this.documentosCapturados[llave];
    }
    this.localidadesFiscal = [];
    this.localidadesComercial = [];
    this.localidadesRepresentante = [];
    this.mensaje = '';
    this.enviado = false;
    this.inicioRegistro.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  private mostrarModalRegistro(tipo: 'success' | 'error', mensaje: string): void {
    this.modalRegistro = {
      visible: true,
      tipo,
      titulo: tipo === 'success' ? 'Operación exitosa' : 'No se pudo completar el registro',
      mensaje
    };
  }

  private esPendienteRevision(comercio: ConsultaComercioApi): boolean {
    const status = String(comercio.status ?? comercio['Status'] ?? comercio['STATUS'] ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return status === '27' || status === 'PENDIENTE_REVISION';
  }

  private excluirPendientesDelArbol(nodos: NodoComercio[], comercios: ConsultaComercioApi[]): NodoComercio[] {
    const pendientes = comercios.filter(comercio => this.esPendienteRevision(comercio));
    const nodeIDs = new Set(pendientes.map(comercio => String(comercio.nodeID ?? '')).filter(Boolean));
    const sirioIDs = new Set(pendientes.map(comercio => comercio.entitySonID).filter(Boolean));
    const filtrar = (lista: NodoComercio[]): NodoComercio[] => lista
      .filter(nodo => !nodeIDs.has(nodo.nodeID || '') && !sirioIDs.has(nodo.entitySonID))
      .map(nodo => ({ ...nodo, hijos: filtrar(nodo.hijos) }));
    return filtrar(nodos);
  }

  private construirArbol(comercios: ConsultaComercioApi[]): NodoComercio[] {
    const nodos = comercios
      .filter(comercio => !this.esPendienteRevision(comercio))
      .map(comercio => this.nodoDesdeComercio(comercio))
      .filter((nodo): nodo is NodoComercio => !!nodo);

    const subAfiliados = new Map<string, NodoComercio>();
    const entidades = new Map<string, NodoComercio>();
    const sucursales = new Map<string, NodoComercio>();
    const raices: NodoComercio[] = [];

    nodos.forEach(nodo => {
      if (nodo.nivel === 'Sub Afiliado') subAfiliados.set(nodo.llave, nodo);
      if (nodo.nivel === 'Entidad') entidades.set(nodo.llave, nodo);
      if (nodo.nivel === 'Sucursal') sucursales.set(nodo.llave, nodo);
    });

    nodos.forEach(nodo => {
      if (nodo.nivel === 'Sub Afiliado') {
        raices.push(nodo);
        return;
      }

      const padre = this.buscarPadreNodo(nodo, subAfiliados, entidades, sucursales);
      if (padre) {
        if (!padre.hijos.some(hijo => hijo.id === nodo.id)) padre.hijos.push(nodo);
        return;
      }

      raices.push(nodo);
    });

    return raices;
  }

  private nodosDesdeArbolApi(respuesta: unknown): NodoComercio[] {
    const nodosApi = this.listaNodosArbol(respuesta);
    if (nodosApi.some(nodo => nodo.depth !== undefined)) return this.arbolPlanoPorProfundidad(nodosApi);
    return nodosApi.map((nodo, index) => this.nodoDesdeArbolApi(nodo, index)).filter((nodo): nodo is NodoComercio => !!nodo);
  }

  private nodoDesdeArbolApi(nodo: ArbolNodoApi, indice = 0): NodoComercio | null {
    if (!nodo || typeof nodo !== 'object') return null;
    const nivel = this.nivelDesdeArbolApi(nodo);
    if (!nivel) return null;
    const id = this.valorNodo(nodo, ['nodeID', 'nodeId', 'idNode', 'id', 'contextID', 'entityID', 'terminalID', 'terminalUserID']) || `nodo-${indice + 1}`;

    return {
      id,
      llave: id,
      nodeID: id,
      entitySonID: this.valorNodo(nodo, ['idSirio', 'sirioId', 'entitySonID']),
      nombre: this.valorNodo(nodo, ['name', 'nodeName', 'contextDescription', 'nameCommerce', 'businessName', 'tuName', 'description']) || id,
      nivel,
      hijos: this.hijosNodosArbol(nodo).map((hijo, index) => this.nodoDesdeArbolApi(hijo, index)).filter((hijo): hijo is NodoComercio => !!hijo)
    };
  }

  private arbolPlanoPorProfundidad(nodosApi: ArbolNodoApi[]): NodoComercio[] {
    const raiz: NodoComercio[] = [];
    const pilaPorProfundidad: NodoComercio[] = [];

    nodosApi.forEach((nodoApi, index) => {
      const nodo = this.nodoDesdeArbolApi(nodoApi, index);
      if (!nodo) return;
      const profundidad = Math.max(0, this.valorNumero(this.valorNodo(nodoApi, ['depth'])));
      const padre = pilaPorProfundidad[profundidad - 1];
      if (padre) padre.hijos.push(nodo);
      else raiz.push(nodo);
      pilaPorProfundidad[profundidad] = nodo;
    });

    return raiz;
  }

  private listaNodosArbol(response: unknown): ArbolNodoApi[] {
    if (Array.isArray(response)) return response.filter(this.esNodoArbolApi);
    if (!response || typeof response !== 'object') return [];
    const body = response as ArbolNodoApi;
    const data = body.data;
    if (Array.isArray(data)) return data.filter(this.esNodoArbolApi);
    if (data && typeof data === 'object') return [data as ArbolNodoApi];
    return [body];
  }

  private hijosNodosArbol(nodo: ArbolNodoApi): ArbolNodoApi[] {
    for (const llave of ['children', 'childs', 'nodes', 'tree']) {
      const hijos = nodo[llave];
      if (Array.isArray(hijos)) return hijos.filter(this.esNodoArbolApi);
    }
    if (Array.isArray(nodo.data)) return nodo.data.filter(this.esNodoArbolApi);
    return [];
  }

  private esNodoArbolApi(valor: unknown): valor is ArbolNodoApi {
    return !!valor && typeof valor === 'object';
  }

  private nivelDesdeArbolApi(nodo: ArbolNodoApi): NivelComercio | null {
    const levelType = this.valorNumero(this.valorNodo(nodo, ['levelType']));
    if (levelType === 3) return 'Sub Afiliado';
    if (levelType === 4) return 'Entidad';
    if (levelType === 5) return 'Sucursal';
    if (levelType === 6) return 'Caja';

    const nivel = this.valorTexto(this.valorNodo(nodo, ['idAffilationLevel', 'level', 'type', 'nodeType'])).toUpperCase();
    if (nivel.includes('SUB')) return 'Sub Afiliado';
    if (nivel.includes('ENTIDAD')) return 'Entidad';
    if (nivel.includes('SUCURSAL')) return 'Sucursal';
    if (nivel.includes('CAJA') || nivel.includes('TERMINAL')) return 'Caja';
    return null;
  }

  private nodoDesdeComercio(comercio: ConsultaComercioApi): NodoComercio | null {
    const nivel = this.nivelDesdeComercio(comercio);
    if (!nivel) return null;
    const llave = this.llavePorNivel(comercio, nivel);

    return {
      id: `${nivel}-${llave || comercio.nodeID || comercio.entitySonID || comercio.commerceID || comercio.nameCommerce}`,
      llave,
      nodeID: String(comercio.nodeID || ''),
      entitySonID: comercio.entitySonID,
      nombre: comercio.nameCommerce || comercio.businessName || comercio.entitySonID || nivel,
      nivel,
      hijos: []
    };
  }

  private nivelDesdeComercio(comercio: ConsultaComercioApi): NivelComercio | null {
    const nivel = `${comercio.idAffilationLevel ?? ''}`.trim().toUpperCase();
    if (nivel.includes('SUB')) return 'Sub Afiliado';
    if (nivel.includes('ENTIDAD')) return 'Entidad';
    if (nivel.includes('SUCURSAL')) return 'Sucursal';
    if (nivel.includes('CAJA') || nivel.includes('TERMINAL')) return 'Caja';
    if (Number(comercio.terminalUserID) > 0) return 'Caja';
    if (Number(comercio.terminalID) > 0) return 'Sucursal';
    if (Number(comercio.entityID) > 0) return 'Entidad';
    if (Number(comercio.contextID) > 0) return 'Sub Afiliado';
    return null;
  }

  private buscarPadreNodo(
    nodo: NodoComercio,
    subAfiliados: Map<string, NodoComercio>,
    entidades: Map<string, NodoComercio>,
    sucursales: Map<string, NodoComercio>
  ): NodoComercio | undefined {
    if (nodo.nivel === 'Entidad') return subAfiliados.values().next().value;
    if (nodo.nivel === 'Sucursal') return entidades.values().next().value ?? subAfiliados.values().next().value;
    if (nodo.nivel === 'Caja') return sucursales.values().next().value ?? entidades.values().next().value ?? subAfiliados.values().next().value;
    return undefined;
  }

  private llavePorNivel(comercio: ConsultaComercioApi, nivel: NivelComercio): string {
    if (nivel === 'Sub Afiliado') return String(comercio.contextID || comercio.nodeID || comercio.entitySonID || '');
    if (nivel === 'Entidad') return String(comercio.entityID || comercio.nodeID || comercio.entitySonID || '');
    if (nivel === 'Sucursal') return String(comercio.terminalID || comercio.nodeID || comercio.entitySonID || '');
    return String(comercio.terminalUserID || comercio.nodeID || comercio.entitySonID || '');
  }

  nivelesDisponiblesPara(nodo: NodoComercio): NivelNuevo[] {
    if (this.idRol === 6) return [];
    if (nodo.nivel === 'Sub Afiliado') {
      return this.idRol === 2
        ? ['Sub Afiliado', 'Entidad', 'Sucursal', 'Caja', 'Referenciador']
        : ['Entidad', 'Sucursal', 'Caja'];
    }
    if (nodo.nivel === 'Entidad') return ['Sucursal', 'Caja'];
    if (nodo.nivel === 'Sucursal') return ['Caja'];
    return [];
  }

  private aplanarNodos(nodos: NodoComercio[]): NodoComercio[] {
    return nodos.flatMap(nodo => [nodo, ...this.aplanarNodos(nodo.hijos)]);
  }

  get bloquearTipoPersona(): boolean {
    const tipo = this.tipoComercioSeleccionado.toLowerCase();
    return (this.nivelNuevo === 'Entidad' || this.nivelNuevo === 'Sucursal')
      && (tipo.includes('persona física') || tipo.includes('persona fisica'));
  }

  private aplicarTipoPersonaPorTipoComercio(tipoComercio: string): void {
    const tipo = tipoComercio.toLowerCase();
    if (tipo.includes('persona física') || tipo.includes('persona fisica')) {
      this.datosForm.controls.tipoPersona.setValue('PF', { emitEvent: false });
    } else if (tipoComercio) {
      this.datosForm.controls.tipoPersona.setValue('PM', { emitEvent: false });
    }
    this.actualizarValidadoresDatos();
  }

  cargarTiposComercioCatalogo(nivel: string): void {
    const idAffiliationType = this.idAffiliationTypePorNivel(nivel);
    if (!idAffiliationType) return;

    const cacheado = this.tiposComercioCatalogoPorNivel[nivel];
    if (cacheado) {
      this.aplicarTiposComercioCatalogo(nivel, cacheado);
      return;
    }

    if (this.tiposComercioCatalogoSolicitados.has(nivel)) return;
    this.tiposComercioCatalogoSolicitados.add(nivel);

    this.preRegistroService.getTiposComercio(idAffiliationType).subscribe({
      next: response => {
        const tipos = this.extraerTiposComercioCatalogo(response);
        if (!tipos.length) return;
        this.tiposComercioCatalogoPorNivel[nivel] = tipos;
        this.aplicarTiposComercioCatalogo(nivel, tipos);
      },
      error: () => this.tiposComercioCatalogoSolicitados.delete(nivel)
    });
  }

  private aplicarTiposComercioCatalogo(nivel: string, tipos: Array<{ id: number; nombre: string }>): void {
    this.typeOfBusinessPorTipoComercio = {
      ...this.typeOfBusinessPorTipoComercio,
      ...Object.fromEntries(tipos.map(tipo => [tipo.nombre, tipo.id]))
    };
    if (this.comercioForm.controls.nivel.value !== nivel) return;

    const tipoActual = this.comercioForm.controls.tipoComercio.value;
    if (tipoActual) {
      this.comercioForm.controls.tipoComercioId.setValue(this.typeOfBusinessPayload(tipoActual), { emitEvent: false });
    }
  }

  private idAffiliationTypePorNivel(nivel: string): number {
    const mapa: Record<string, number> = {
      'Sub Afiliado': 3,
      Referenciador: 3,
      Entidad: 4,
      Sucursal: 5,
      Caja: 6
    };
    return mapa[nivel] ?? 0;
  }

  private typeOfBusinessPayload(tipoComercio: string): number {
    return this.typeOfBusinessPorTipoComercio[tipoComercio]
      || this.typeOfBusinessFallbackPorTipoComercio[tipoComercio]
      || 0;
  }

  private extraerTiposComercioCatalogo(response: unknown): Array<{ id: number; nombre: string }> {
    return this.extraerListaTiposComercio(response)
      .map(tipo => ({
        id: this.valorNumero(tipo.idTypeOfBusiness ?? tipo.typeOfBusiness ?? tipo.id ?? tipo.value ?? tipo.code),
        nombre: this.valorTexto(tipo.description ?? tipo.descripcion ?? tipo.name ?? tipo.nombre ?? tipo.label ?? tipo.businessType ?? tipo.typeBusiness)
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
      body['catTypeOfBusinesses']
    ];
    const list = possibleLists.find(Array.isArray);
    if (Array.isArray(list)) return list as TipoComercioCatalogo[];

    for (const value of Object.values(body)) {
      const nestedList = this.extraerListaTiposComercio(value);
      if (nestedList.length) return nestedList;
    }
    return [];
  }

  private valorTexto(valor: unknown): string {
    return valor === null || valor === undefined ? '' : String(valor).trim();
  }

  private llaveDocumento(documento: DocumentoRequerido): string {
    const tipoPersona = this.datosForm.controls.tipoPersona.value === 'PF' ? 'PF' : 'PM';
    return `${tipoPersona}-${documento.numero}`;
  }

  private construirPayloadCaja(): AltaNivelComercioPayload {
    const nombreCaja = this.valorTexto(this.comercioForm.controls.nombreCaja.value);
    const tipoCaja = this.comercioForm.controls.tipoComercio.value;
    return {
      parentNodeId: this.parentNodeIdSeleccionado(),
      nameCommerce: nombreCaja,
      name: nombreCaja,
      paternalSurname: '',
      maternalSurname: '',
      liquidationLevel: '0',
      dispersionAccount: 'CONC_ADQUI',
      isAliasUser: true,
      typeOfBusiness: this.typeOfBusinessPayload(tipoCaja)
    };
  }

  private construirPayloadAlta(): AltaNivelComercioPayload {
    const datos = this.datosForm.getRawValue();
    const comercio = this.comercioForm.getRawValue();
    const tipoPersona = this.esCajaSeleccionada ? 'PF' : this.valorTexto(datos.tipoPersona) || 'PM';
    const nombreComercio = this.valorTexto(datos.nombreComercial || comercio.nombreCaja || this.nivelNuevo);
    const esPersonaFisica = tipoPersona === 'PF';

    const payload: AltaNivelComercioPayload = {
      parentNodeId: this.parentNodeIdSeleccionado(),
      nameCommerce: nombreComercio,
      businessName: esPersonaFisica ? '' : this.valorTexto(datos.razonSocial || nombreComercio),
      idBussinesLine: this.valorNumero(datos.mcc || datos.actividadId),
      businessActivityCode: this.valorTexto(datos.mcc || datos.actividadId),
      bussinesLineDescription: this.valorTexto(datos.descripcionGiro || datos.giroComercial || datos.actividad),
      idActivity: this.valorNumero(datos.actividadId),
      email: this.valorTexto(datos.correo),
      name: esPersonaFisica ? this.valorTexto(datos.nombre) : '',
      paternalSurname: esPersonaFisica ? this.valorTexto(datos.apellidoPaterno) : '',
      maternalSurname: esPersonaFisica ? this.valorTexto(datos.apellidoMaterno) : '',
      phoneNumber: this.valorTexto(datos.telefono),
      rfc: this.valorTexto(datos.rfc),
      curp: this.valorTexto(datos.curp),
      fiscalRegime: this.valorTexto(datos.regimenFiscal),
      typePerson: tipoPersona,
      liquidationLevel: '0',
      dispersionAccount: 'CONC_ADQUI',
      typeOfBusiness: this.typeOfBusinessPayload(comercio.tipoComercio),
      commerceAddress: [this.construirDireccion('DF'), this.construirDireccion('DC')],
    };

    payload.contacts = [
      ...(!esPersonaFisica ? [{
        type: 1,
        name: this.valorTexto(datos.nombreRepresentante),
        paternalSurname: this.valorTexto(datos.apellidoPaternoRepresentante),
        maternalSurname: this.valorTexto(datos.apellidoMaternoRepresentante),
        address: this.construirDireccionRepresentante()
      }] : []),
      {
        type: 2,
        phoneNumber: this.valorTexto(datos.telefonoComercial),
        email: this.valorTexto(datos.correoComercial),
        ...(this.valorTexto(datos.telefonoAdicionalComercial) ? {
          additionaPhoneNumber: this.valorTexto(datos.telefonoAdicionalComercial)
        } : {})
      }
    ];

    if (this.nivelNuevo === 'Caja') payload.assignClabeAccount = true;
    return payload;
  }

  private construirDireccion(addressType: 'DF' | 'DC'): Record<string, string> {
    const datos = this.datosForm.getRawValue();
    const comercial = addressType === 'DC';
    return {
      addressType,
      postalCode: this.valorTexto(comercial ? datos.codigoPostalComercial : datos.codigoPostal),
      roadType: this.valorTexto(comercial ? datos.tipoVialidadComercial : datos.tipoVialidad),
      roadName: this.valorTexto(comercial ? datos.nombreVialidadComercial : datos.nombreVialidad),
      extNum: this.valorTexto(comercial ? datos.numeroExteriorComercial : datos.numeroExterior),
      intNum: this.valorTexto(comercial ? datos.numeroInteriorComercial : datos.numeroInterior),
      district: this.valorTexto(comercial ? datos.coloniaComercial : datos.colonia),
      location: this.valorTexto(comercial ? datos.localidadComercial : datos.localidad),
      municipality: this.valorTexto(comercial ? datos.municipioComercial : datos.municipio),
      federativeEntity: this.valorTexto(comercial ? datos.entidadFederativaComercial : datos.entidadFederativa),
      betweenStreet: this.valorTexto(comercial ? datos.entreCalleComercial : datos.entreCalle) || 'ND',
      andStreet: this.valorTexto(comercial ? datos.yCalleComercial : datos.yCalle) || 'ND',
      locationID: ''
    };
  }

  private construirDireccionRepresentante(): Record<string, string | null> {
    const datos = this.datosForm.getRawValue();
    return {
      street: this.valorTexto(datos.calleRepresentante),
      exteriorNumber: this.valorTexto(datos.numeroExteriorRepresentante),
      interiorNumber: this.valorTexto(datos.numeroInteriorRepresentante),
      postalCode: this.valorTexto(datos.codigoPostalRepresentante),
      suburb: this.valorTexto(datos.coloniaRepresentante) || null,
      city: null,
      municipality: this.valorTexto(datos.municipioRepresentante),
      state: this.valorTexto(datos.estadoRepresentante),
      idLocation: this.valorTexto(datos.locationIDRepresentante)
    };
  }

  private parentNodeIdSeleccionado(): number {
    return this.valorNumero(this.nodoSeleccionado?.nodeID || this.nodoSeleccionado?.id || this.nodoSeleccionado?.llave);
  }

  private prepararDocumentosParaSubida(response: unknown): DocumentoPreregistroUpload[] {
    const guid = this.extraerCommerceGuid(response);
    if (!guid) return [];

    return this.documentosVisibles
      .map(documento => {
        if (!documento.archivo) return undefined;
        return {
          guid,
          fileName: this.nombreArchivoDocumento(guid, documento),
          file: documento.archivo,
        };
      })
      .filter((documento): documento is DocumentoPreregistroUpload => !!documento);
  }

  private nombreArchivoDocumento(guid: string, documento: DocumentoRequerido): string {
    const extension = documento.archivo?.name.split('.').pop()?.toLowerCase() || 'pdf';
    const nombre = documento.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return `${guid}_${documento.numero}_${nombre}.${extension}`;
  }

  private extraerCommerceGuid(response: unknown): string {
    if (!response || typeof response !== 'object') return '';
    const body = response as Record<string, unknown>;
    const directo = this.valorTexto(
      body['commerceGuid']
      || body['commerceID']
      || body['commerceId']
      || body['guid']
      || body['id']
    );
    if (directo) return directo;

    for (const value of Object.values(body)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          const guid = this.extraerCommerceGuid(item);
          if (guid) return guid;
        }
      } else {
        const guid = this.extraerCommerceGuid(value);
        if (guid) return guid;
      }
    }
    return '';
  }

  private valorNodo(nodo: ArbolNodoApi, llaves: string[]): string {
    for (const llave of llaves) {
      const valor = nodo[llave];
      if (valor !== undefined && valor !== null && `${valor}`.trim() !== '') return `${valor}`.trim();
    }
    return '';
  }

  private valorNumero(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }
}
