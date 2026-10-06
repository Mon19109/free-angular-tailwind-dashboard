import { CommonModule } from '@angular/common';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { concatMap, finalize, from, of, switchMap, tap, throwError, toArray } from 'rxjs';
import { StepAccesosComponent, UsuarioAccesoConfig } from '../preRegistro/components/accesos/step-accesos.component';
import { StepComercioComponent } from '../preRegistro/components/comercio/step-comercio.component';
import { StepDatosComponent } from '../preRegistro/components/datos-generales/step-datos.component';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';
import { StepLiquidacionComponent } from '../preRegistro/components/liquidacion/step-liquidacion.component';
import { DocumentoRequerido } from '../preRegistro/models/preregistro.models';
import { ThemeToggleButtonComponent } from '../../shared/components/common/theme-toggle/theme-toggle-button.component';
import { ProspectoCliente, ProspectoClienteService } from '../../services/prospecto-cliente.service';
import { CuentaComercioService } from '../../services/cuenta-comercio.service';
import { ArbolNodoApi, ArbolNodosService } from '../../services/arbol-nodos.service';
import { DocumentoProspectoApi, DocumentosProspectoService } from '../../services/documentos-prospecto.service';
import { ActividadesService } from '../../services/actividades.service';

import { ActualizarDatosComercioService } from '../../services/actualizar-datos-comercio.service';
import { RegistroLiquidacionPayload, RegistroLiquidacionService } from '../../services/registro-liquidacion.service';

import { PreRegistroService } from '../../services/preregistro.service';
import { PreregistroDocumentosService } from '../../services/preregistro-documentos.service';
import { RegistroAccesoPayload, RegistroAccesosService } from '../../services/registro-accesos.service';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';

type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type PrefijoAcceso = 'admin' | 'fac' | 'tkt' | 'controlador' | 'supervisor';

interface NodoProspecto {
  id: string;
  nombre: string;
  nivel: 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' | string;
  idSirio?: string;
  nodeID?: string;
  levelType?: number;
  commerceGuid?: string;
  hijos?: NodoProspecto[];
}

@Component({
  selector: 'app-registro-prospecto-cliente',
  host: { '[class.internal-registration-host]': 'modoInterno' },
  standalone: true,
  imports: [
    ProcessingOverlayComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    StepComercioComponent,
    StepDatosComponent,
    StepAccesosComponent,
    StepDocumentosComponent,
    StepLiquidacionComponent,
    ThemeToggleButtonComponent
  ],
  templateUrl: './registroProspectoCliente.component.html',
  styleUrls: ['../login/login.component.css', '../registroCliente/registroCliente.component.css', './registroProspectoCliente.component.css']
})
export class RegistroProspectoClienteComponent implements OnInit, OnChanges {
  @Input() modoInterno = false;
  @Input() seccionInterna: 'liquidacion' | 'accesos' | null = null;
  @Output() seccionInternaChange = new EventEmitter<'liquidacion' | 'accesos' | null>();
  @Input() arbolInterno: NodoProspecto[] = [];
  @Input() nodoInterno = '';
  @Output() nodoInternoChange = new EventEmitter<string>();

  ngOnChanges(changes?: SimpleChanges): void {
    if (changes && !changes['modoInterno'] && !changes['arbolInterno'] && !changes['nodoInterno']) return;
    if (!this.modoInterno) return;
    this.showTokenModal = false;
    this.cargando = false;
    this.arbolRealCargado = true;
    this.arbol = this.arbolInterno;
    if (this.nodoInterno) this.seleccionarNodo(this.nodoInterno);
  }

  readonly prospectoBearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
  private readonly fb = inject(FormBuilder);
  private readonly registroAccesosService = inject(RegistroAccesosService);
  private readonly seguimientoProspectoService = inject(SeguimientoProspectoService);
  private readonly accesosCompletadosPorNodo = new Set<string>();
  private readonly preregistroDocumentosService = inject(PreregistroDocumentosService);
  private readonly actualizarDatosComercioService = inject(ActualizarDatosComercioService);
  private readonly registroLiquidacionService = inject(RegistroLiquidacionService);
  private readonly preRegistroService = inject(PreRegistroService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly route = inject(ActivatedRoute);
  private readonly prospectoService = inject(ProspectoClienteService);
  private readonly cuentaComercioService = inject(CuentaComercioService);
  private readonly arbolNodosService = inject(ArbolNodosService);
  private readonly documentosService = inject(DocumentosProspectoService);
  private readonly prospectIdStorageKey = 'kashpay.registro_prospecto.prospectId';

  readonly tiposCuenta = ['CLABE', 'Tarjeta'];
  private readonly usuariosBase: UsuarioAccesoConfig[] = [
    {
      prefijo: 'admin',
      titulo: 'Administrador de la Plataforma',
      descripcion: 'con Acceso Total y Gestión de Pagos.',
      icono: 'fa-regular fa-user'
    }
  ];
  private readonly usuariosFacTkt: UsuarioAccesoConfig[] = [
    {
      prefijo: 'fac',
      titulo: 'Usuario Administrador FAC',
      descripcion: 'con acceso para administración FAC.',
      icono: 'fa-regular fa-user'
    },
    {
      prefijo: 'tkt',
      titulo: 'Usuario Administrador TKT',
      descripcion: 'con acceso para administración TKT.',
      icono: 'fa-regular fa-user'
    }
  ];
  private readonly usuariosAgrupadora: UsuarioAccesoConfig[] = [
    {
      prefijo: 'controlador',
      titulo: 'Usuario Controlador de Recursos',
      descripcion: 'para controlar los recursos del comercio.',
      icono: 'fa-solid fa-user-shield'
    },
    {
      prefijo: 'supervisor',
      titulo: 'Usuario Supervisor de Terminales',
      descripcion: 'para supervisar las terminales del comercio.',
      icono: 'fa-solid fa-user-check'
    }
  ];

  readonly accesosForm = this.fb.nonNullable.group({
    modoReserva: ['NINGUNO' as ModoReserva, Validators.required],
    reservaSplit: [''],
    adminNombre: ['', Validators.required],
    adminPaterno: ['', Validators.required],
    adminMaterno: ['', Validators.required],
    adminCorreo: ['', [Validators.required, Validators.email]],
    adminConfirmarCorreo: ['', [Validators.required, Validators.email]],
    adminTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
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
    digitoVerificador: [''],
    tipoPersonaBeneficiario: ['fisica' as TipoPersonaBeneficiario, Validators.required],
    beneficiarioIgualComercio: [false],
    nombreBeneficiario: ['', Validators.required],
    apellidoPaternoBeneficiario: ['', Validators.required],
    apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]],
    direccionBeneficiario: ['', Validators.required],
    rfcBeneficiario: ['', [Validators.required, this.rfcValidator()]],
    actividadBeneficiario: ['', Validators.required],
    giroBeneficiario: ['', Validators.required],
    idActivity: this.fb.control<number | null>(null),
    giro: this.fb.control<number | null>(null),
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', Validators.required],
    idInstitution: this.fb.control<number | null>(null),
    accountNumber: this.fb.control<string | null>(null),
    nombreBanco: ['', Validators.required],
    direccionBanco: ['', Validators.required],
    telefonoBanco: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    emailBanco: ['', [Validators.required, Validators.email]]
  });

  prospectId = '';
  link = '';
  cargando = true;
  guardando = false;
  error = '';
  pasoActivo: 'liquidacion' | 'accesos' = 'liquidacion';
  prospecto: ProspectoCliente | null = null;
  cuentaComercio: Record<string, unknown> | null = null;
  arbol: NodoProspecto[] = [];
  nodoSeleccionado = '';
  usuarioActivo = 'admin';
  cargandoCuenta = false;
  liquidacionConsultada = false;
  liquidacionExistente = false;
  errorLiquidacion = '';
  guardandoLiquidacion = false;
  liquidacionRegistrada = false;
  modalLiquidacion: 'en-red' | 'guardada' | null = null;
  private readonly liquidacionPorNodo: Record<string, ReturnType<RegistroProspectoClienteComponent['estadoLiquidacionActual']>> = {};
  private arbolRealCargado = false;
  private consultaCuentaVersion = 0;
  private opcionLiquidacionAnterior = 'otros-bancos';
  modalAccesos: string | null = null;
  errorProspecto = '';
  intentoGuardarLiquidacion = false;
  erroresArchivos: Record<'carta' | 'edc', string> = { carta: '', edc: '' };
  errorCatalogoLiquidacion = '';
  private consultaCatalogoVersion = 0;
  cargandoArbol = false;
  errorArbol = '';
  showTokenModal = true;
  tokenValue = '';
  tokenErrorMessage = '';
  validandoToken = false;
  private tokenSmsValidado = false;
  readonly mostrarSoloPasosFinales = true;
  seccionInformativaAbierta: 'comercio' | 'datos' | 'documentos' | null = 'comercio';
  cargandoDocumentos = false;
  documentosProspecto: DocumentoProspectoApi[] = [];
  archivosInvalidos = false;
  cartaLiquidacionArchivoNombre = '';
  caratulaEdcArchivoNombre = '';
  private documentosLiquidacionSubidos = false;
  validandoArchivos = 0;
  private perfilesEnviadosPorNodo: Record<string, number[]> = {};
  private cartaLiquidacionArchivo: File | null = null;
  private caratulaEdcArchivo: File | null = null;
  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: ['']
  });
  readonly datosForm = this.fb.nonNullable.group({
    razonSocial: [''], nombreComercial: [''], rfc: [''], regimenFiscal: [''], giroComercial: [''], descripcionGiro: [''], mcc: [''],
    mismaInfoFiscalEntidad: [false], nombre: [''], apellidoPaterno: [''], apellidoMaterno: [''], curp: [''], actividad: [''], tipoPersona: [''],
    correo: ['', Validators.email], telefono: [''], departamento: [''], ciudad: [''], direccionComercial: [''], codigoPostal: [''], tipoVialidad: [''],
    nombreVialidad: [''], numeroExterior: [''], numeroInterior: [''], colonia: [''], localidad: [''], municipio: [''], entidadFederativa: [''],
    locationID: [''], entreCalle: [''], yCalle: [''], nombreRepresentante: [''], apellidoPaternoRepresentante: [''], apellidoMaternoRepresentante: [''],
    calleRepresentante: [''], numeroExteriorRepresentante: [''], numeroInteriorRepresentante: [''], codigoPostalRepresentante: [''], coloniaRepresentante: [''],
    municipioRepresentante: [''], estadoRepresentante: [''], locationIDRepresentante: [''], correoRepresentante: [''], telefonoRepresentante: [''],
    telefonoAdicionalRepresentante: [''], mismoDomicilio: [false], codigoPostalComercial: [''], tipoVialidadComercial: [''], nombreVialidadComercial: [''],
    numeroExteriorComercial: [''], numeroInteriorComercial: [''], coloniaComercial: [''], localidadComercial: [''], municipioComercial: [''],
    entidadFederativaComercial: [''], locationIDComercial: [''], entreCalleComercial: [''], yCalleComercial: [''], correoComercial: [''],
    telefonoComercial: [''], telefonoAdicionalComercial: ['']
  });
  readonly niveles = ['Sub Afiliado', 'Entidad', 'Sucursal', 'Caja'];
  readonly tiposComercio = ['Empresa Grupo', 'Sucursales de Grupo', 'Persona Física'];
  readonly tiposPersona = ['Jurídica', 'Natural'];
  readonly regimenesFiscales: string[] = [];
  readonly girosComerciales: string[] = [];
  readonly departamentos: string[] = [];
  readonly ciudades: string[] = [];
  readonly documentos: DocumentoRequerido[] = [];
  private accesosPorNodo: Record<string, ReturnType<typeof this.accesosForm.getRawValue>> = {};

  ngOnInit(): void {
    if (!this.modoInterno) {
      const params = this.route.snapshot.queryParamMap;
      const pathLink = this.route.snapshot.paramMap.get('link') || '';
      this.prospectId = params.get('prospectId')
        || params.get('prospect')
        || params.get('id')
        || localStorage.getItem(this.prospectIdStorageKey)
        || '';
      this.link = params.get('link') || pathLink;

      if (params.get('prospectId') || params.get('prospect') || params.get('id')) {
        localStorage.setItem(this.prospectIdStorageKey, this.prospectId);
      }
    }

    this.liquidacionForm.controls.cuentaFueraRed.valueChanges
      .subscribe(valor => this.cambiarOpcionLiquidacion(valor));
    this.liquidacionForm.controls.tipoPersonaBeneficiario.valueChanges
      .subscribe(tipo => this.actualizarValidadoresBeneficiario(tipo as TipoPersonaBeneficiario));
    this.liquidacionForm.controls.beneficiarioIgualComercio.valueChanges
      .subscribe(valor => {
        if (valor) this.sincronizarBeneficiarioDesdeComercio();
        else this.limpiarDatosBeneficiario();
      });
    this.liquidacionForm.controls.tipoCuenta.valueChanges
      .subscribe(() => this.actualizarValidadorCuentaLiquidacion());

    this.actualizarEstadoLiquidacion();
    this.actualizarValidadorCuentaLiquidacion();
    this.actualizarValidadoresAccesos();

    if (this.modoInterno) return;
    if (!this.link) {
      this.cargando = false;
      this.error = 'El link no contiene token para validar el registro.';
      return;
    }

    this.cargarProspecto();
  }

  validarTokenSms(): void {
    if (this.validandoToken || this.cargando || this.errorProspecto) return;
    const token = this.tokenValue.trim();
    if (!token) {
      this.tokenErrorMessage = 'Captura el token enviado por SMS.';
      return;
    }

    this.validandoToken = true;
    this.tokenErrorMessage = '';
    this.prospectoService.validarTokenSms({
      commerceGuid: this.texto(this.prospecto?.commerceGuid)
        || this.texto(this.prospecto?.guidCommerce)
        || this.prospectId,
      id: '20001',
      observations: token
    }).pipe(
      finalize(() => this.validandoToken = false)
    ).subscribe({
      next: (resp: any) => {
        if (resp?.success === false) {
          this.tokenErrorMessage = resp?.error?.message || resp?.message || 'El token capturado no es válido.';
          return;
        }

        this.showTokenModal = false;
        this.tokenSmsValidado = true;
        if (this.prospecto) this.consultarCuentaComercio();
        else this.cargarProspecto();
      },
      error: (error: unknown) => {
        const errorResponse = error as {
          error?: {
            error?: { message?: string };
            message?: string;
          };
        };
        this.tokenErrorMessage = errorResponse.error?.error?.message
          || errorResponse.error?.message
          || 'No fue posible validar el token.';
      }
    });
  }

  clearTokenError(): void {
    this.tokenErrorMessage = '';
  }

  alternarSeccionInformativa(seccion: 'comercio' | 'datos' | 'documentos'): void {
    this.seccionInformativaAbierta = this.seccionInformativaAbierta === seccion ? null : seccion;
  }

  closeTokenModal(): void {
    if (this.validandoToken) return;
    this.cerrarPagina();
  }

  continuarLiquidacion(): void {
    if (!this.nodoRequiereAccesos || this.errorProspecto || this.guardando || !this.liquidacionConsultada || this.cargandoCuenta || this.guardandoLiquidacion) return;
    if (this.liquidacionCompleta) {
      this.abrirAccesos();
      return;
    }
    if (this.liquidacionForm.controls.cuentaFueraRed.value === 'en-red') {
      this.modalLiquidacion = 'en-red';
      return;
    }
    this.intentoGuardarLiquidacion = true;
    this.liquidacionForm.markAllAsTouched();
    if (this.liquidacionForm.invalid) {
      this.error = 'Completa los campos obligatorios (*) de liquidación y corrige los datos inválidos antes de continuar.';
      this.pasoActivo = 'liquidacion';
      return;
    }
    if (this.validandoArchivos || this.erroresArchivos.carta || this.erroresArchivos.edc || !this.cartaLiquidacionArchivo || !this.caratulaEdcArchivo) {
      this.error = 'Adjunta la Carta de Liquidación y la Carátula EDC en PDF antes de continuar.';
      return;
    }
    const guid = this.texto(this.cuentaComercio?.['commerceGuid']).trim();
    if (!guid) {
      this.error = 'No se encontró el identificador del comercio para subir los documentos.';
      return;
    }
    const datos = this.liquidacionForm.getRawValue();
    if (!datos.idInstitution || (datos.tipoPersonaBeneficiario === 'moral' ? datos.giro === null : datos.idActivity === null)) {
      this.error = 'Selecciona el banco y el giro o actividad desde sus búsquedas antes de continuar.';
      return;
    }
    const tipo = datos.tipoPersonaBeneficiario === 'moral' ? 'PM' : 'PF';
    const nombre = (tipo === 'PM' ? [datos.nombreBeneficiario] : [datos.nombreBeneficiario, datos.apellidoPaternoBeneficiario, datos.apellidoMaternoBeneficiario]).filter(Boolean).join(' ').trim();
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    const sirioId = nodo?.idSirio?.trim();

    if (!sirioId) {
      this.error = 'No se encontró el idSirio del nodo seleccionado para registrar la cuenta de liquidación.';
      return;
    }
    const payload: RegistroLiquidacionPayload = {
      identifier: sirioId,
      nameAlias: nombre,
      cardNumberMask: datos.cuentaClabe,
      numberPhone: '',
      typeRegister: 'CL',
      email: datos.correoBeneficiario,
      typeTransfer: 1,
      fullName: nombre,
      nameInstitution: datos.nombreBanco,
      idInstitution: datos.idInstitution,
      razonSocial: tipo === 'PM' ? nombre : '',
      accountNumber: datos.accountNumber,
      beneficiaryType: tipo,
      show: true,
      aditionalData: {
        addressBank: { street: datos.direccionBanco },
        beneficiaryAddress: { street: datos.direccionBeneficiario },
        aditionalReferences: ['', '', ''],
        destinationCountry: '',
        intermediaryBank: '',
        bankName: datos.nombreBanco,
        bankPhone: datos.telefonoBanco,
        bankEmail: datos.emailBanco,
        currency: '484',
        ...(tipo === 'PM'
          ? { businessLine: `${datos.giro}|${datos.giroBeneficiario}` }
          : { businessActivity: `${datos.idActivity}|${datos.actividadBeneficiario}` }),
        typeAccount: tipo
      }
    };
    this.error = '';
    this.guardandoLiquidacion = true;
    const documentos = this.documentosLiquidacionSubidos ? of([]) : this.preregistroDocumentosService.subirDocumentos([
      { guid, fileName: `${guid}_CARTA_LIQUIDACION.pdf`, file: this.cartaLiquidacionArchivo },
      { guid, fileName: `${guid}_CARATULA_EDO_CTA.pdf`, file: this.caratulaEdcArchivo }
    ], this.obtenerBearerConsulta(), { crearDirectorio: false });
    let dispersionActualizada = false;
    this.actualizarDatosComercioService.actualizarDispersion(
      guid, datos.cuentaFueraRed === 'otros-bancos-en-red' ? 'OTHER_BANK_AND_NETWORK' : 'OTHER_BANK',
      this.modoInterno ? this.obtenerBearerConsulta() : undefined
    ).pipe(
      tap(() => dispersionActualizada = true),
      switchMap(() => documentos),
      switchMap(respuestas => respuestas.some(respuesta => (respuesta as { success?: boolean } | null)?.success === false)
        ? throwError(() => new Error('No fue posible subir los documentos.'))
        : of(respuestas)),
      tap(() => this.documentosLiquidacionSubidos = true),
      switchMap(() => this.registroLiquidacionService.registrar(payload, this.modoInterno ? this.obtenerBearerConsulta() : undefined)),
      finalize(() => this.guardandoLiquidacion = false)
    ).subscribe({
      next: respuesta => {
        if (respuesta?.success === false) {
          this.error = respuesta.message || 'No fue posible registrar la cuenta de liquidación.';
          return;
        }
        this.liquidacionRegistrada = true;
        this.modalLiquidacion = 'guardada';
      },
      error: () => this.error = !dispersionActualizada
        ? 'No fue posible actualizar la cuenta de dispersión. Intenta nuevamente.'
        : this.documentosLiquidacionSubidos
        ? 'Los documentos se subieron, pero no fue posible registrar la cuenta de liquidación. Intenta nuevamente.'
        : 'No fue posible subir los documentos. El registro de liquidación aún no se ha enviado. Intenta nuevamente.'
    });
  }

  aceptarModalLiquidacion(): void {
    if (!this.nodoRequiereAccesos || !this.modalLiquidacion || this.guardandoLiquidacion) return;
    if (this.modalLiquidacion === 'en-red') {
      const guid = this.texto(this.cuentaComercio?.['commerceGuid']).trim();
      if (!guid) {
        this.error = 'No se encontró el identificador del comercio en el resumen.';
        return;
      }
      this.error = '';
      this.guardandoLiquidacion = true;
      this.actualizarDatosComercioService.actualizarDispersion(guid, 'NETWORK', this.modoInterno ? this.obtenerBearerConsulta() : undefined).pipe(
        finalize(() => this.guardandoLiquidacion = false)
      ).subscribe({
        next: () => {
          this.liquidacionRegistrada = true;
          this.modalLiquidacion = null;
          this.abrirAccesos();
        },
        error: () => this.error = 'No fue posible actualizar la cuenta de dispersión. Intenta nuevamente.'
      });
      return;
    }
    this.modalLiquidacion = null;
    this.abrirAccesos();
  }

  private cambiarOpcionLiquidacion(valor: string): void {
    if (valor === 'en-red') this.modalLiquidacion = 'en-red';
    else this.opcionLiquidacionAnterior = valor;
    this.actualizarEstadoLiquidacion();
    this.actualizarValidadoresAccesos();
  }

  cancelarModalLiquidacion(): void {
    if (this.modalLiquidacion !== 'en-red' || this.guardandoLiquidacion) return;
    this.modalLiquidacion = null;
    this.liquidacionForm.controls.cuentaFueraRed.setValue(this.opcionLiquidacionAnterior, { emitEvent: false });
    this.actualizarEstadoLiquidacion();
    this.actualizarValidadoresAccesos();
    this.pasoActivo = 'liquidacion';
  }

  private abrirAccesos(): void {
    this.error = '';
    this.pasoActivo = 'accesos';
    if (this.modoInterno) this.seccionInternaChange.emit('accesos');
    this.asegurarUsuarioActivo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  seleccionarArchivoLiquidacion(event: Event, tipo: 'carta' | 'edc'): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.asignarArchivoLiquidacion(archivo, tipo);
  }

  soltarArchivoLiquidacion(event: DragEvent, tipo: 'carta' | 'edc'): void {
    event.preventDefault();
    event.stopPropagation();
    const archivo = event.dataTransfer?.files?.[0] ?? null;
    this.asignarArchivoLiquidacion(archivo, tipo);
  }

  bloquearArrastreArchivo(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:dragover', ['$event'])
  prevenirDragoverDocumento(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('document:drop', ['$event'])
  prevenirDropDocumento(event: DragEvent): void {
    event.preventDefault();
  }

  private async asignarArchivoLiquidacion(archivo: File | null, tipo: 'carta' | 'edc'): Promise<void> {
    if (!archivo || this.guardandoLiquidacion || this.validandoArchivos || this.liquidacionCompleta) return;
    this.validandoArchivos++;
    try {
      const cabecera = new TextDecoder().decode(await archivo.slice(0, 5).arrayBuffer());
      if (!/\.pdf$/i.test(archivo.name) || (archivo.type && archivo.type !== 'application/pdf') || cabecera !== '%PDF-') {
        this.erroresArchivos[tipo] = 'Solo se permiten archivos PDF válidos.';
        this.error = this.erroresArchivos[tipo];
        return;
      }
      this.error = '';
      this.erroresArchivos[tipo] = '';
      this.documentosLiquidacionSubidos = false;
      if (tipo === 'carta') {
        this.cartaLiquidacionArchivo = archivo;
        this.cartaLiquidacionArchivoNombre = archivo.name;
      } else {
        this.caratulaEdcArchivo = archivo;
        this.caratulaEdcArchivoNombre = archivo.name;
      }
    } catch {
      this.erroresArchivos[tipo] = 'No fue posible leer el archivo. Selecciona nuevamente el PDF.';
      this.error = this.erroresArchivos[tipo];
    } finally {
      this.validandoArchivos--;
    }
  }

  errorArchivoLiquidacion(tipo: 'carta' | 'edc'): string {
    if (this.erroresArchivos[tipo]) return this.erroresArchivos[tipo];
    const archivo = tipo === 'carta' ? this.cartaLiquidacionArchivo : this.caratulaEdcArchivo;
    return this.intentoGuardarLiquidacion && !archivo ? 'Debes adjuntar este documento en PDF.' : '';
  }

  volverLiquidacion(): void {
    if (this.liquidacionCompleta) return;
    this.pasoActivo = 'liquidacion';
    if (this.modoInterno) this.seccionInternaChange.emit('liquidacion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get seccionFinalAbierta(): 'liquidacion' | 'accesos' | null {
    return this.modoInterno ? this.seccionInterna : this.pasoActivo;
  }

  alternarSeccionFinal(seccion: 'liquidacion' | 'accesos'): void {
    if (this.modoInterno) {
      this.seccionInternaChange.emit(this.seccionInterna === seccion ? null : seccion);
      return;
    }
    if (seccion === 'liquidacion') this.volverLiquidacion();
    else this.continuarLiquidacion();
  }

  get accesosCompletos(): boolean {
    if (!this.nodoRequiereAccesos) return false;
    if (this.cuentaComercio?.['hasPlatformAccess'] === true) return true;
    const perfiles = this.perfilesEnviadosPorNodo[this.nodoSeleccionado] || [];
    return this.accesosCompletadosPorNodo.has(this.nodoSeleccionado)
      && this.usuariosAcceso.every(usuario => perfiles.includes(this.perfilAcceso(usuario.prefijo)));
  }

  nodoRegistroCompleto(id: string): boolean {
    if (id === this.nodoSeleccionado) return this.liquidacionCompleta && this.accesosCompletos;
    const liquidacion = this.liquidacionPorNodo[id];
    return !!liquidacion && (liquidacion.existente || liquidacion.registrada)
      && (liquidacion.cuenta?.['hasPlatformAccess'] === true || this.accesosCompletadosPorNodo.has(id));
  }

  private perfilAcceso(prefijo: string): RegistroAccesoPayload['idProfile'] {
    if (prefijo === 'controlador') return 9;
    if (prefijo === 'supervisor') return 8;
    if (prefijo === 'fac') return 7;
    if (prefijo === 'tkt') return 5;
    return 1;
  }

  finalizar(): void {
    if (this.errorProspecto || this.guardandoLiquidacion || !this.nodoRequiereAccesos || this.guardando || this.accesosCompletos) return;
    this.error = '';
    const link = this.link.trim();
    if (!link && !this.modoInterno) {
      this.error = 'No se encontró el enlace de seguimiento del prospecto. No se enviaron los accesos.';
      return;
    }
    this.actualizarValidadoresAccesos();
    this.accesosForm.markAllAsTouched();
    this.guardarAccesosNodoActual();
    if (!this.liquidacionCompleta || this.accesosForm.invalid) {
      this.error = 'Completa todos los datos de los accesos requeridos. Si aparecen FAC y TKT, debes llenar ambos.';
      const incompleto = this.usuariosAcceso.find(usuario => ['Nombre', 'Paterno', 'Materno', 'Correo', 'ConfirmarCorreo', 'Telefono'].some(campo => this.accesosForm.get(`${usuario.prefijo}${campo}`)?.invalid) || this.accesosForm.hasError(`${usuario.prefijo}CorreosDistintos`));
      if (incompleto) this.usuarioActivo = incompleto.prefijo;
      return;
    }
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    if (!nodo?.idSirio || !nodo.levelType || ![3, 4, 5].includes(nodo.levelType)) {
      this.error = 'No se encontró el idSirio o el nivel del nodo en el árbol. No se enviaron los accesos.';
      return;
    }
    const nodoId = nodo.id;
    const enviados = this.perfilesEnviadosPorNodo[nodoId] ??= [];
    const solicitudes = this.usuariosAcceso.map(usuario => {
      const valor = (campo: string) => String(this.accesosForm.get(`${usuario.prefijo}${campo}`)?.value ?? '').trim();
      const payload: RegistroAccesoPayload = {
        sirioId: nodo.idSirio!, idAffiliationLevel: nodo.levelType!, idProfile: this.perfilAcceso(usuario.prefijo),
        name: valor('Nombre'), paternalSurname: valor('Paterno'), maternalSurname: valor('Materno'),
        email: valor('Correo'), phoneNumber: valor('Telefono')
      };
      return { prefijo: usuario.prefijo, payload };
    }).filter(solicitud => !enviados.includes(solicitud.payload.idProfile));
    this.guardando = true;
    let accesosEnviados = false;
    from(solicitudes).pipe(
      concatMap(solicitud => this.registroAccesosService.agregarUsuario(solicitud.payload).pipe(
        tap(() => {
          enviados.push(solicitud.payload.idProfile);
          this.bloquearAccesoEnviado(solicitud.prefijo);
        })
      )),
      toArray(),
      tap(() => accesosEnviados = true),
      switchMap(() => !this.modoInterno && (nodo.levelType === 5 || !this.siguienteNodoPendiente())
        ? this.seguimientoProspectoService.completar(link) : of(undefined)),
      tap(() => this.accesosCompletadosPorNodo.add(nodoId)),
      finalize(() => this.guardando = false)
    ).subscribe({
      complete: () => {
        if (!this.modoInterno && !this.siguienteNodoPendiente() && this.nodoRegistroCompleto(nodoId)) {
          this.cerrarPagina();
          return;
        }
        this.modalAccesos = nodo.nombre;
      },
      error: () => this.error = accesosEnviados
        ? 'Los accesos se enviaron, pero no fue posible completar el seguimiento. Reintenta; los accesos ya enviados no se enviarán nuevamente.'
        : 'No fue posible enviar todos los accesos de este nodo. Reintenta; los accesos ya enviados no se enviarán nuevamente.'
    });
  }

  aceptarModalAccesos(): void {
    if (this.modalAccesos === null) return;
    this.modalAccesos = null;
    const siguiente = this.siguienteNodoPendiente();
    if (siguiente) {
      if (this.modoInterno) this.nodoInternoChange.emit(siguiente.id);
      else this.seleccionarNodo(siguiente.id);
    } else if (!this.modoInterno && this.nodoRegistroCompleto(this.nodoSeleccionado)) {
      this.cerrarPagina();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private siguienteNodoPendiente(): NodoProspecto | undefined {
    const aplanar = (nodos: NodoProspecto[]): NodoProspecto[] =>
      nodos.flatMap(nodo => [nodo, ...aplanar(nodo.hijos ?? [])]);
    const nodos = aplanar(this.arbol);
    const indice = nodos.findIndex(nodo => nodo.id === this.nodoSeleccionado);
    const siguientes = [...nodos.slice(indice + 1), ...nodos.slice(0, indice)];
    return siguientes.find(nodo => {
      const requiereRegistro = nodo.levelType
        ? [3, 4, 5].includes(nodo.levelType)
        : ['SUB AFILIADO', 'ENTIDAD', 'SUCURSAL'].includes(this.normalizar(nodo.nivel));
      return requiereRegistro && !this.nodoRegistroCompleto(nodo.id);
    });
  }

  private bloquearAccesoEnviado(prefijo: string): void {
    for (const campo of ['Nombre', 'Paterno', 'Materno', 'Correo', 'ConfirmarCorreo', 'Telefono']) {
      this.accesosForm.get(`${prefijo}${campo}`)?.disable({ emitEvent: false });
    }
  }

  private cargarProspecto(): void {
    this.cargando = true;
    this.error = '';

    this.prospectoService.obtenerProspecto(this.prospectId, this.link).pipe(
      finalize(() => this.cargando = false)
    ).subscribe({
      next: resp => {
        if (resp?.success === false) {
          this.mostrarErrorProspecto(resp.error?.message || resp.message || 'No fue posible validar el link del prospecto.');
          return;
        }
        this.prospecto = resp?.accountResponse ?? null;
        this.precargarDatosProspecto();
        if (this.tokenSmsValidado) this.consultarCuentaComercio();
      },
      error: respuesta => {
        this.mostrarErrorProspecto(respuesta?.error?.error?.message || respuesta?.error?.message || 'No fue posible validar el link del prospecto.');
      }
    });
  }

  private mostrarErrorProspecto(mensaje: string): void {
    this.errorProspecto = mensaje;
    this.showTokenModal = false;
    this.tokenSmsValidado = false;
    this.prospecto = null;
  }

  cerrarPagina(): void {
    window.close();
    // Dar tiempo al cierre antes de salir del registro si el navegador lo bloquea.
    window.setTimeout(() => {
      if (!window.closed) this.salirPaginaEnBlanco();
    }, 100);
  }

  private salirPaginaEnBlanco(): void {
    window.location.replace('about:blank');
  }

  private precargarDatosProspecto(): void {
    if (!this.prospecto) return;

    this.arbol = this.construirArbol();
    this.nodoSeleccionado = this.arbol[0]?.id || '';

    this.accesosForm.patchValue({
      adminCorreo: this.texto(this.prospecto.email),
      adminConfirmarCorreo: this.texto(this.prospecto.email),
      adminTelefono: this.texto(this.prospecto.phoneNumber)
    }, { emitEvent: false });
  }

  get camposDatosGenerales(): string[] {
    return [
      'tipoPersona', 'razonSocial', 'nombreComercial', 'rfc', 'regimenFiscal', 'giroComercial', 'descripcionGiro', 'mcc',
      'correo', 'telefono', 'codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia',
      'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'nombreRepresentante', 'apellidoPaternoRepresentante',
      'apellidoMaternoRepresentante', 'calleRepresentante', 'numeroExteriorRepresentante', 'numeroInteriorRepresentante',
      'codigoPostalRepresentante', 'coloniaRepresentante', 'municipioRepresentante', 'estadoRepresentante', 'correoRepresentante',
      'telefonoRepresentante', 'codigoPostalComercial', 'tipoVialidadComercial', 'nombreVialidadComercial', 'numeroExteriorComercial',
      'numeroInteriorComercial', 'coloniaComercial', 'localidadComercial', 'municipioComercial', 'entidadFederativaComercial',
      'entreCalleComercial', 'yCalleComercial', 'correoComercial', 'telefonoComercial'
    ];
  }

  get documentosVisibles(): DocumentoRequerido[] {
    return this.documentosProspecto.map((documento, index) => ({
      numero: index + 1,
      nombre: this.texto(documento.documentName || documento.name || documento.fileName) || `Documento ${index + 1}`,
      obligatorio: true,
      archivoNombre: this.texto(documento.originalName || documento.fileName || documento.documentName),
      archivoUrl: this.texto(documento.url || documento.fileUrl || documento.path),
      archivoId: this.texto(documento.id || documento.documentID || documento.documentId),
      s3Key: this.texto(documento.s3Key),
      estatusRevision: this.estatusDocumento(documento)
    }));
  }

  get documentosCargados(): number {
    return this.documentosVisibles.filter(documento => !!(documento.archivoNombre || documento.archivoUrl)).length;
  }

  get documentosPendientes(): number {
    return Math.max(this.documentosVisibles.length - this.documentosCargados, 0);
  }

  private cargarFormulariosDesdeGet(): void {
    const datos = { ...(this.prospecto ?? {}), ...(this.cuentaComercio ?? {}) } as Record<string, unknown>;
    const direcciones = this.listaObjetos(datos['commerceAddress']);
    const fiscal = direcciones.find(direccion => this.texto(direccion['addressType']).toUpperCase() === 'DF') || direcciones[0] || {};
    const comercial = direcciones.find(direccion => this.texto(direccion['addressType']).toUpperCase() === 'DC') || fiscal;
    const contactos = this.listaObjetos(datos['contacts']);
    const representante = contactos.find(contacto => Number(contacto['type']) === 1) || contactos[0] || {};
    const contactoComercial = contactos.find(contacto => Number(contacto['type']) === 2) || contactos[1] || {};

    this.comercioForm.patchValue({
      nivel: this.texto(datos['level'] || datos['levelType'] || datos['commerceType']) || 'Sucursal',
      tipoComercio: this.texto(datos['commerceType'] || datos['type']) || 'Sucursales de Grupo'
    }, { emitEvent: false });
    this.datosForm.patchValue({
      tipoPersona: this.texto(datos['typePerson']) || 'PM',
      razonSocial: this.texto(datos['businessName']),
      nombreComercial: this.texto(datos['nameCommerce'] || datos['name']),
      nombre: this.texto(datos['name']),
      apellidoPaterno: this.texto(datos['paternalSurname']),
      apellidoMaterno: this.texto(datos['maternalSurname']),
      actividad: this.texto(datos['activityDescription']),
      rfc: this.texto(datos['rfc']),
      regimenFiscal: this.texto(datos['fiscalRegime']),
      giroComercial: this.texto(datos['bussinesLineDescription']),
      descripcionGiro: this.texto(datos['activityDescription']),
      mcc: this.texto(datos['businessActivityCode']),
      correo: this.texto(contactoComercial['email'] || datos['email']),
      telefono: this.texto(contactoComercial['phoneNumber'] || datos['phoneNumber']),
      codigoPostal: this.texto(fiscal['postalCode']),
      tipoVialidad: this.texto(fiscal['roadType']),
      nombreVialidad: this.texto(fiscal['roadName']),
      numeroExterior: this.texto(fiscal['extNum']),
      numeroInterior: this.texto(fiscal['intNum']),
      colonia: this.texto(fiscal['district'] || fiscal['location']),
      localidad: this.texto(fiscal['location']),
      municipio: this.texto(fiscal['municipality']),
      entidadFederativa: this.texto(fiscal['federativeEntity']),
      entreCalle: this.texto(fiscal['betweenStreet']),
      yCalle: this.texto(fiscal['andStreet']),
      nombreRepresentante: this.texto(representante['name']),
      apellidoPaternoRepresentante: this.texto(representante['paternalSurname']),
      apellidoMaternoRepresentante: this.texto(representante['maternalSurname']),
      correoRepresentante: this.texto(representante['email']),
      telefonoRepresentante: this.texto(representante['phoneNumber']),
      calleRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['street']),
      numeroExteriorRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['exteriorNumber']),
      numeroInteriorRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['interiorNumber']),
      codigoPostalRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['postalCode']),
      coloniaRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['suburb']),
      municipioRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['municipality']),
      estadoRepresentante: this.texto((representante['address'] as Record<string, unknown> | undefined)?.['state']),
      codigoPostalComercial: this.texto(comercial['postalCode']),
      tipoVialidadComercial: this.texto(comercial['roadType']),
      nombreVialidadComercial: this.texto(comercial['roadName']),
      numeroExteriorComercial: this.texto(comercial['extNum']),
      numeroInteriorComercial: this.texto(comercial['intNum']),
      coloniaComercial: this.texto(comercial['district'] || comercial['location']),
      localidadComercial: this.texto(comercial['location']),
      municipioComercial: this.texto(comercial['municipality']),
      entidadFederativaComercial: this.texto(comercial['federativeEntity']),
      entreCalleComercial: this.texto(comercial['betweenStreet']),
      yCalleComercial: this.texto(comercial['andStreet']),
      correoComercial: this.texto(contactoComercial['email'] || datos['email']),
      telefonoComercial: this.texto(contactoComercial['phoneNumber'] || datos['phoneNumber'])
    }, { emitEvent: false });
    this.comercioForm.disable({ emitEvent: false });
    this.datosForm.disable({ emitEvent: false });
    if (!this.modoInterno) this.consultarDocumentos(this.texto(datos['commerceID'] || datos['commerceId'] || datos['commerceGuid'] || this.prospecto?.id));
    if (this.liquidacionForm.controls.beneficiarioIgualComercio.value) {
      this.sincronizarBeneficiarioDesdeComercio();
    } else {
      this.precargarCatalogoLiquidacion();
    }
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const direccion = this.datosForm.getRawValue();
    const datos = { ...(this.prospecto ?? {}), ...(this.cuentaComercio ?? {}) } as Record<string, unknown>;
    const esMoral = this.texto(direccion.tipoPersona) === 'PM';
    const nombre = esMoral
      ? this.texto(direccion.razonSocial) || this.texto(direccion.nombreComercial)
      : this.texto(direccion.nombre);
    const direccionCompleta = [
      direccion.tipoVialidad,
      direccion.nombreVialidad,
      direccion.numeroExterior,
      direccion.numeroInterior,
      direccion.colonia,
      direccion.municipio,
      direccion.entidadFederativa,
      direccion.codigoPostal
    ].filter(Boolean).join(' ');

    this.liquidacionForm.patchValue({
      tipoPersonaBeneficiario: esMoral ? 'moral' : 'fisica',
      nombreBeneficiario: nombre,
      apellidoPaternoBeneficiario: esMoral ? '' : this.texto(direccion.apellidoPaterno),
      apellidoMaternoBeneficiario: esMoral ? '' : this.texto(direccion.apellidoMaterno),
      correoBeneficiario: this.texto(datos['email']),
      direccionBeneficiario: direccionCompleta,
      rfcBeneficiario: this.texto(direccion.rfc),
    }, { emitEvent: false });
    this.precargarCatalogoLiquidacion();
  }

  private precargarCatalogoLiquidacion(): void {
    const datos = { ...(this.prospecto ?? {}), ...(this.cuentaComercio ?? {}) };
    const tipo: TipoPersonaBeneficiario = this.texto(datos['typePerson']).toUpperCase() === 'PM' ? 'moral' : 'fisica';
    const codigo = this.codigoCatalogo(tipo === 'moral' ? datos['businessActivityCode'] : datos['idActivity']);
    const version = ++this.consultaCatalogoVersion;
    this.errorCatalogoLiquidacion = '';
    this.liquidacionForm.patchValue({
      tipoPersonaBeneficiario: tipo,
      idActivity: tipo === 'fisica' ? codigo : null,
      giro: tipo === 'moral' ? codigo : null,
      actividadBeneficiario: tipo === 'fisica' ? this.texto(datos['activityDescription']) : '',
      giroBeneficiario: tipo === 'moral' ? this.texto(datos['bussinesLineDescription']) : ''
    }, { emitEvent: false });
    this.actualizarValidadoresBeneficiario(tipo);
    if (codigo === null) return;
    const campoId = tipo === 'moral' ? 'giro' : 'idActivity';
    const campoDescripcion = tipo === 'moral' ? 'giroBeneficiario' : 'actividadBeneficiario';
    const descripcionInicial = this.liquidacionForm.controls[campoDescripcion].value;
    const sigueVigente = () => version === this.consultaCatalogoVersion
      && this.liquidacionForm.controls.tipoPersonaBeneficiario.value === tipo
      && this.liquidacionForm.controls[campoId].value === codigo
      && this.liquidacionForm.controls[campoDescripcion].value === descripcionInicial;
    const consulta = tipo === 'moral'
      ? this.preRegistroService.getGirosByFamily(String(codigo))
      : this.actividadesService.getActividades();
    consulta.subscribe({
      next: respuesta => {
        if (!sigueVigente()) return;
        const entradas = this.entradasCatalogo(respuesta);
        const claves = tipo === 'moral' ? ['giro', 'idGiro', 'mcc', 'MCC', 'id', 'code'] : ['idcat_actividades', 'idActivity', 'id', 'code'];
        const entrada = entradas.find(item => claves.some(clave => this.codigoCatalogo(item[clave]) === codigo));
        const descripcion = entrada && ['descripcion', 'description', 'desGiro', 'actividad', 'activity', 'nombre', 'name', 'label'].map(clave => this.texto(entrada[clave])).find(Boolean);
        if (descripcion) this.liquidacionForm.controls[campoDescripcion].setValue(descripcion);
        else if (!descripcionInicial) this.errorCatalogoLiquidacion = 'No se encontró la descripción del catálogo. Selecciona la actividad o el giro con Buscar.';
      },
      error: () => {
        if (sigueVigente()) this.errorCatalogoLiquidacion = 'No fue posible consultar el catálogo. Usa Buscar para seleccionar la actividad o el giro.';
      }
    });
  }

  private entradasCatalogo(respuesta: unknown): Record<string, unknown>[] {
    if (Array.isArray(respuesta)) return this.listaObjetos(respuesta);
    if (!respuesta || typeof respuesta !== 'object') return [];
    const objeto = respuesta as Record<string, unknown>;
    for (const clave of ['rows', 'data', 'giros', 'catGiroResponse', 'result', 'response', 'items', 'list', 'content']) {
      const entradas = this.entradasCatalogo(objeto[clave]);
      if (entradas.length) return entradas;
    }
    return [objeto];
  }

  private limpiarDatosBeneficiario(): void {
    this.liquidacionForm.patchValue({
      nombreBeneficiario: '',
      apellidoPaternoBeneficiario: '',
      apellidoMaternoBeneficiario: '',
      correoBeneficiario: '',
      direccionBeneficiario: '',
      rfcBeneficiario: '',
      actividadBeneficiario: '',
      giroBeneficiario: '',
      idActivity: null,
      giro: null
    }, { emitEvent: false });
  }

  private listaObjetos(valor: unknown): Record<string, unknown>[] {
    return Array.isArray(valor)
      ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      : [];
  }

  private consultarDocumentos(commerceId: string): void {
    if (!commerceId) return;
    this.cargandoDocumentos = true;
    const nodoId = this.nodoSeleccionado;
    this.documentosService.consultarDocumentos(commerceId, this.obtenerBearerConsulta()).pipe(
      finalize(() => { if (this.nodoSeleccionado === nodoId) this.cargandoDocumentos = false; })
    ).subscribe({
      next: respuesta => { if (this.nodoSeleccionado === nodoId) this.documentosProspecto = respuesta.legalDocuments || respuesta.documents || []; },
      error: () => { if (this.nodoSeleccionado === nodoId) this.documentosProspecto = []; }
    });
  }

  private estatusDocumento(documento: DocumentoProspectoApi): 'APPROVED' | 'REJECTED' | 'IN_REVIEW' | undefined {
    const estado = documento.status || documento.documentStatus;
    return estado === 'APPROVED' || estado === 'REJECTED' || estado === 'IN_REVIEW' ? estado : undefined;
  }

  seleccionarArchivo(_event: Event, _documento: DocumentoRequerido): void {}

  validarArchivo(_documento: DocumentoRequerido, _estado: 'APPROVED' | 'REJECTED'): void {}

  verDocumentoProspecto(documento: DocumentoRequerido): void {
    if (documento.s3Key) {
      this.documentosService.consultarUrlArchivo(documento.s3Key, this.obtenerBearerConsulta()).subscribe(url => window.open(url, '_blank', 'noopener'));
      return;
    }
    if (documento.archivoUrl) window.open(documento.archivoUrl, '_blank', 'noopener');
  }

  seleccionarNodo(id: string): void {
    if (this.guardando || this.guardandoLiquidacion || this.validandoArchivos) return;
    this.error = '';
    if (id === this.nodoSeleccionado) return;
    this.guardarAccesosNodoActual();
    if (this.nodoSeleccionado && this.nodoRequiereAccesos && this.liquidacionConsultada) {
      this.liquidacionPorNodo[this.nodoSeleccionado] = this.estadoLiquidacionActual();
    }
    this.nodoSeleccionado = id;
    this.restaurarLiquidacionNodo();
    const accesos = this.accesosPorNodo[id];
    this.accesosForm.enable({ emitEvent: false });
    this.accesosForm.reset();
    if (accesos) this.accesosForm.patchValue(accesos, { emitEvent: false });
    this.asegurarUsuarioActivo();
    this.actualizarValidadoresAccesos();
  }

  private estadoLiquidacionActual() {
    return {
      datos: this.liquidacionForm.getRawValue(),
      datosComercio: this.datosForm.getRawValue(),
      comercio: this.comercioForm.getRawValue(),
      documentos: this.documentosProspecto,
      cuenta: this.cuentaComercio,
      existente: this.liquidacionExistente,
      registrada: this.liquidacionRegistrada,
      paso: this.pasoActivo,
      carta: this.cartaLiquidacionArchivo,
      edc: this.caratulaEdcArchivo,
      documentosSubidos: this.documentosLiquidacionSubidos,
      erroresArchivos: { ...this.erroresArchivos },
      intentoGuardar: this.intentoGuardarLiquidacion,
      opcionAnterior: this.opcionLiquidacionAnterior
    };
  }

  private restaurarLiquidacionNodo(): void {
    const estado = this.liquidacionPorNodo[this.nodoSeleccionado];
    this.consultaCatalogoVersion++;
    this.consultaCuentaVersion++;
    this.datosForm.reset(estado?.datosComercio, { emitEvent: false });
    this.comercioForm.reset(estado?.comercio, { emitEvent: false });
    this.documentosProspecto = estado?.documentos ?? [];
    this.cargandoDocumentos = false;
    this.liquidacionForm.reset(estado?.datos, { emitEvent: false });
    this.cuentaComercio = estado?.cuenta ?? null;
    this.liquidacionConsultada = !!estado;
    this.liquidacionExistente = estado?.existente ?? false;
    this.liquidacionRegistrada = estado?.registrada ?? false;
    this.pasoActivo = estado?.paso ?? 'liquidacion';
    this.cartaLiquidacionArchivo = estado?.carta ?? null;
    this.caratulaEdcArchivo = estado?.edc ?? null;
    this.cartaLiquidacionArchivoNombre = this.cartaLiquidacionArchivo?.name ?? '';
    this.caratulaEdcArchivoNombre = this.caratulaEdcArchivo?.name ?? '';
    this.documentosLiquidacionSubidos = estado?.documentosSubidos ?? false;
    this.erroresArchivos = estado?.erroresArchivos ?? { carta: '', edc: '' };
    this.intentoGuardarLiquidacion = estado?.intentoGuardar ?? false;
    this.opcionLiquidacionAnterior = estado?.opcionAnterior ?? 'otros-bancos';
    this.errorLiquidacion = '';
    this.errorCatalogoLiquidacion = '';
    this.modalLiquidacion = null;
    this.modalAccesos = null;
    this.cargandoCuenta = false;
    this.actualizarEstadoLiquidacion();
    if (!estado && this.nodoRequiereAccesos) this.consultarLiquidacionNodo();
  }

  private consultarLiquidacionNodo(): void {
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    if (!nodo || !this.nodoRequiereAccesos) return;
    this.liquidacionConsultada = false;
    this.liquidacionExistente = false;
    this.liquidacionRegistrada = false;
    this.errorLiquidacion = '';
    if (!nodo.idSirio) {
      this.errorLiquidacion = 'No se encontró el idSirio del nodo seleccionado.';
      return;
    }
    this.cargandoCuenta = true;
    const version = ++this.consultaCuentaVersion;
    this.cuentaComercioService.consultarCuenta(nodo.idSirio, this.obtenerBearerConsulta()).pipe(
      finalize(() => {
        if (this.consultaCuentaVersion === version) this.cargandoCuenta = false;
      })
    ).subscribe({
      next: respuesta => {
        if (this.consultaCuentaVersion !== version) return;
        if (respuesta.success === false) {
          this.errorLiquidacion = respuesta.error?.message || respuesta.message || 'No fue posible consultar la cuenta del nodo.';
          return;
        }
        this.cuentaComercio = this.extraerCuenta(respuesta);
        this.validarLiquidacionDesdeCuenta();
        this.cargarFormulariosDesdeGet();
      },
      error: () => {
        if (this.consultaCuentaVersion === version) this.errorLiquidacion = 'No fue posible consultar la cuenta del nodo. Reintenta la consulta.';
      }
    });
  }

  get usuariosAcceso(): UsuarioAccesoConfig[] {
    if (!this.nodoRequiereAccesos) return [];
    const tipoComercio = Number(this.cuentaComercio?.['typeOfBusiness']);
    if (tipoComercio === 5 || tipoComercio === 17) {
      const prefijo = tipoComercio === 5 ? 'controlador' : 'supervisor';
      return this.usuariosAgrupadora.filter(usuario => usuario.prefijo === prefijo);
    }
    if (this.liquidacionForm.controls.cuentaFueraRed.value === 'otros-bancos-en-red') return this.usuariosFacTkt;
    return this.usuariosBase;
  }

  get contextoSirio(): string {
    return this.texto(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.idSirio)
      || this.texto(this.cuentaComercio?.['idSirio'])
      || this.texto(this.prospecto?.['idSirio'])
      || this.texto(this.prospecto?.id)
      || this.prospectId
      || 'ND';
  }

  get contextoNombre(): string {
    return this.texto(this.cuentaComercio?.['nameCommerce'])
      || this.texto(this.cuentaComercio?.['businessName'])
      || this.texto(this.buscarNodo(this.arbol, this.nodoSeleccionado)?.nombre)
      || this.texto(this.prospecto?.nameCommerce)
      || this.texto(this.prospecto?.businessName)
      || 'Comercio';
  }

  get contextoNivel(): string {
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    const niveles: Record<number, string> = { 3: 'Sub-afiliado', 4: 'Entidad', 5: 'Sucursal', 6: 'Caja' };
    if (nodo?.levelType && niveles[nodo.levelType]) return niveles[nodo.levelType];
    if (nodo?.nivel) return nodo.nivel.charAt(0).toUpperCase() + nodo.nivel.slice(1);
    return this.texto(this.cuentaComercio?.['commerceType'])
      || this.texto(this.cuentaComercio?.['entityType'])
      || this.texto(this.prospecto?.['commerceType'])
      || 'Comercio';
  }

  get rutaSeleccionada(): string {
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado) || this.arbol[0];
    if (!nodo) return 'Ubicación pendiente';
    return `${nodo.nivel} - ${nodo.nombre}`;
  }

  get nodoRequiereAccesos(): boolean {
    const nodo = this.buscarNodo(this.arbol, this.nodoSeleccionado);
    if (nodo?.levelType) return [3, 4, 5].includes(nodo.levelType);
    const nivel = this.normalizar(this.texto(nodo?.nivel));
    if (nivel.includes('CAJA') || nivel.includes('TERMINAL')) return false;
    return nivel.includes('SUB AFILIADO')
      || nivel.includes('ENTIDAD')
      || nivel.includes('SUCURSAL');
  }

  get municipioSeleccionado(): string {
    return this.texto(this.cuentaComercio?.['municipality'])
      || this.texto(this.cuentaComercio?.['city'])
      || this.texto(this.prospecto?.['city'])
      || 'ND';
  }

  get esSucursalAgrupadora(): boolean {
    const texto = `${this.contextoNivel} ${this.texto(this.cuentaComercio?.['commerceType'])}`.toLowerCase();
    return texto.includes('agrup') || texto.includes('grupo');
  }

  private actualizarEstadoLiquidacion(): void {
    const requiereDatos = ['otros-bancos', 'otros-bancos-en-red', 'si'].includes(this.liquidacionForm.controls.cuentaFueraRed.value);
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
      this.actualizarValidadoresAccesos();
      return;
    }

    controles.forEach(control => control.enable({ emitEvent: false }));
    this.liquidacionForm.controls.tipoPersonaBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.nombreBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.correoBeneficiario.setValidators([Validators.required, Validators.email]);
    this.liquidacionForm.controls.direccionBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.rfcBeneficiario.setValidators([Validators.required, this.rfcValidator()]);
    this.liquidacionForm.controls.tipoCuenta.setValidators([Validators.required]);
    this.liquidacionForm.controls.cuentaClabe.setValidators([Validators.required]);
    this.liquidacionForm.controls.nombreBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.direccionBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.telefonoBanco.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
    this.liquidacionForm.controls.emailBanco.setValidators([Validators.required, Validators.email]);
    this.actualizarValidadoresBeneficiario(this.liquidacionForm.controls.tipoPersonaBeneficiario.value as TipoPersonaBeneficiario);
    controles.forEach(control => control.updateValueAndValidity({ emitEvent: false }));
    this.actualizarValidadorCuentaLiquidacion();
    this.actualizarValidadoresAccesos();
  }

  private actualizarValidadoresBeneficiario(tipo: TipoPersonaBeneficiario): void {
    if (tipo === 'moral') this.liquidacionForm.controls.idActivity.setValue(null, { emitEvent: false });
    else this.liquidacionForm.controls.giro.setValue(null, { emitEvent: false });
    const apellidosRequeridos = tipo === 'fisica';
    this.liquidacionForm.controls.apellidoPaternoBeneficiario.setValidators(apellidosRequeridos ? [Validators.required] : []);
    this.liquidacionForm.controls.apellidoMaternoBeneficiario.setValidators(apellidosRequeridos ? [Validators.required] : []);
    this.liquidacionForm.controls.actividadBeneficiario.setValidators(tipo === 'fisica' ? [Validators.required] : []);
    this.liquidacionForm.controls.giroBeneficiario.setValidators(tipo === 'moral' ? [Validators.required] : []);
    this.liquidacionForm.controls.rfcBeneficiario.setValidators([Validators.required, this.rfcValidator()]);

    [
      this.liquidacionForm.controls.apellidoPaternoBeneficiario,
      this.liquidacionForm.controls.apellidoMaternoBeneficiario,
      this.liquidacionForm.controls.actividadBeneficiario,
      this.liquidacionForm.controls.giroBeneficiario,
      this.liquidacionForm.controls.rfcBeneficiario
    ].forEach(control => control.updateValueAndValidity({ emitEvent: false }));
  }

  private actualizarValidadorCuentaLiquidacion(): void {
    const control = this.liquidacionForm.controls.cuentaClabe;
    const tipoCuenta = this.liquidacionForm.controls.tipoCuenta.value;
    const validadores = tipoCuenta === 'Tarjeta'
      ? [Validators.required, this.numeroCuentaValidator(16, 'tarjetaInvalida')]
      : [Validators.required, this.numeroCuentaValidator(18, 'clabeInvalida')];

    control.setValidators(validadores);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private camposCoincidenValidator(campo: string, confirmacion: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const origen = control.get(campo)?.value;
      const destino = control.get(confirmacion)?.value;
      if (!origen || !destino || origen === destino) return null;
      return { [errorKey]: true };
    };
  }

  private numeroCuentaValidator(longitud: number, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`;
      if (!valor) return null;
      return new RegExp(`^\\d{${longitud}}$`).test(valor) ? null : { [errorKey]: true };
    };
  }

  private rfcValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(valor) ? null : { rfcInvalido: true };
    };
  }

  texto(valor: unknown): string {
    return typeof valor === 'string' ? valor : '';
  }

  consultarCuentaComercio(): void {
    if (this.cargandoCuenta) return;
    if (this.arbolRealCargado) {
      this.consultarLiquidacionNodo();
      return;
    }
    const sirioId = this.texto(this.prospecto?.['idSirio'])
      || this.texto(this.prospecto?.id)
      || this.prospectId;
    if (!sirioId) return;

    this.cargandoCuenta = true;
    this.errorLiquidacion = '';
    this.liquidacionRegistrada = false;
    this.liquidacionConsultada = false;
    this.liquidacionExistente = false;
    this.cuentaComercioService.consultarCuenta(sirioId, this.obtenerBearerConsulta()).pipe(
      finalize(() => this.cargandoCuenta = false)
    ).subscribe({
      next: respuesta => {
        if (respuesta.success === false) {
          this.cuentaComercio = null;
          this.errorLiquidacion = respuesta.error?.message || respuesta.message || 'No fue posible consultar la cuenta del comercio. Reintenta la consulta.';
          return;
        }
        this.cuentaComercio = this.extraerCuenta(respuesta);
        this.validarLiquidacionDesdeCuenta();
        this.cargarFormulariosDesdeGet();
        this.arbol = this.construirArbol();
        this.nodoSeleccionado = this.arbol[0]?.id || '';
        this.consultarArbolReal(sirioId);
      },
      error: () => {
        this.cuentaComercio = null;
        this.errorLiquidacion = 'No fue posible consultar la cuenta del comercio. Reintenta la consulta.';
      }
    });
  }

  get liquidacionCompleta(): boolean {
    return this.liquidacionConsultada && (this.liquidacionExistente || this.liquidacionRegistrada);
  }

  private validarLiquidacionDesdeCuenta(): void {
    const dispersion = this.texto(this.cuentaComercio?.['dispersionAccount']).trim();
    const opciones: Record<string, string> = {
      NETWORK: 'en-red',
      OTHER_BANK: 'otros-bancos',
      OTHER_BANK_AND_NETWORK: 'otros-bancos-en-red'
    };
    const opcion = Object.prototype.hasOwnProperty.call(opciones, dispersion) ? opciones[dispersion] : undefined;
    this.liquidacionExistente = !!opcion;
    this.liquidacionRegistrada = false;
    this.liquidacionConsultada = true;
    this.errorLiquidacion = '';
    this.liquidacionForm.controls.cuentaFueraRed.setValue(opcion || 'otros-bancos', { emitEvent: false });
    this.actualizarEstadoLiquidacion();
    this.actualizarValidadoresAccesos();
    this.pasoActivo = this.liquidacionExistente ? 'accesos' : 'liquidacion';
    this.asegurarUsuarioActivo();
  }

  private extraerCuenta(respuesta: unknown): Record<string, unknown> {
    if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) return {};
    const objeto = respuesta as Record<string, unknown>;
    const contenido = [objeto['entityInfo'], objeto['account'], objeto['data']]
      .find(item => item && typeof item === 'object' && !Array.isArray(item));
    if (!contenido) return objeto;
    const cuenta = this.extraerCuenta(contenido);
    // El GET puede enviar estos datos junto a entityInfo, account o data.
    // Los valores de la cuenta tienen prioridad sobre los del contenedor.
    return {
      ...cuenta,
      typeOfBusiness: cuenta['typeOfBusiness'] ?? objeto['typeOfBusiness'],
      hasPlatformAccess: cuenta['hasPlatformAccess'] ?? objeto['hasPlatformAccess'],
    };
  }

  private obtenerBearerConsulta(): string {
    if (!this.modoInterno && this.link) return this.prospectoBearerToken;

    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Usa las llaves individuales como respaldo.
    }

    return localStorage.getItem('token')
      || localStorage.getItem('auth_token')
      || (this.modoInterno ? '' : this.prospectoBearerToken);
  }

  private construirArbol(): NodoProspecto[] {
    const nombre = this.contextoNombre;
    const nivel = this.contextoNivel || 'Sucursal';
    const id = this.contextoSirio;
    const caja = this.texto(this.cuentaComercio?.['terminalName'])
      || this.texto(this.prospecto?.['terminalName']);

    const raiz: NodoProspecto = {
      id,
      nombre,
      nivel,
      idSirio: id,
      nodeID: this.texto(this.cuentaComercio?.['nodeID']) || this.texto(this.prospecto?.['nodeID']),
      commerceGuid: this.prospectId
    };

    if (caja) {
      raiz.hijos = [{
        id: `${id}-caja`,
        nombre: caja,
        nivel: 'Caja'
      }];
    }

    return [raiz];
  }

  private buscarNodo(nodos: NodoProspecto[], id: string): NodoProspecto | undefined {
    for (const nodo of nodos) {
      if (nodo.id === id) return nodo;
      const hijo = this.buscarNodo(nodo.hijos ?? [], id);
      if (hijo) return hijo;
    }
    return undefined;
  }

  private consultarArbolReal(sirioIdConsultado: string): void {
    const nodeID = this.valorTexto(this.cuentaComercio?.['nodeID'])
      || this.valorTexto(this.cuentaComercio?.['nodeId'])
      || this.valorTexto(this.prospecto?.['nodeID'])
      || this.valorTexto(this.prospecto?.['nodeId'])
      || this.valorTexto(this.cuentaComercio?.['id'])
      || this.valorTexto(this.cuentaComercio?.['idTerminal'])
      || this.valorTexto(this.prospecto?.['idTerminal'])
      || this.prospectId;
    if (!nodeID) return;

    const cuentaInicial = this.estadoLiquidacionActual();
    this.cargandoArbol = true;
    this.errorArbol = '';
    this.arbolNodosService.obtenerArbol(nodeID, this.link ? this.prospectoBearerToken : undefined).pipe(
      finalize(() => this.cargandoArbol = false)
    ).subscribe({
      next: respuesta => {
        const arbol = this.nodosDesdeArbol(respuesta);
        if (!arbol.length) return;
        const aplanar = (nodos: NodoProspecto[]): NodoProspecto[] =>
          nodos.flatMap(nodo => [nodo, ...aplanar(nodo.hijos ?? [])]);
        const nodoConsultado = aplanar(arbol).find(nodo => nodo.idSirio === sirioIdConsultado);
        // Asociar la consulta inicial al ID real del árbol evita consultar al padre dos veces.
        // Nunca reutilizar esa cuenta para un nodo con otro idSirio.
        if (nodoConsultado && [3, 4, 5].includes(nodoConsultado.levelType ?? 0)) {
          this.liquidacionPorNodo[nodoConsultado.id] = cuentaInicial;
        }
        this.arbol = arbol;
        this.arbolRealCargado = true;
        this.nodoSeleccionado = '';
        const primerNivelAccesos = this.buscarPrimerNodoAccesos(this.arbol) || this.arbol[0];
        this.seleccionarNodo(primerNivelAccesos.id);
      },
      error: (error: unknown) => {
        const respuesta = error as { error?: { error?: { message?: string }; message?: string } };
        this.errorArbol = respuesta.error?.error?.message
          || respuesta.error?.message
          || 'No fue posible consultar el árbol del comercio.';
      }
    });
  }

  private nodosDesdeArbol(respuesta: unknown): NodoProspecto[] {
    const nodos = this.listaNodosArbol(respuesta);
    if (nodos.some(nodo => nodo.depth !== undefined)) return this.arbolPlanoPorProfundidad(nodos);
    return nodos.map((nodo, index) => this.nodoDesdeApi(nodo, index)).filter((nodo): nodo is NodoProspecto => !!nodo);
  }

  private nodoDesdeApi(nodo: ArbolNodoApi, index = 0): NodoProspecto | null {
    if (!nodo || typeof nodo !== 'object') return null;
    const id = this.valorNodo(nodo, ['nodeID', 'nodeId', 'idNode', 'id', 'contextID', 'entityID', 'terminalID', 'terminalUserID']) || `nodo-${index + 1}`;
    const hijos = this.hijosNodosArbol(nodo).map((hijo, i) => this.nodoDesdeApi(hijo, i)).filter((hijo): hijo is NodoProspecto => !!hijo);
    return {
      id,
      nombre: this.valorNodo(nodo, ['name', 'nodeName', 'contextDescription', 'nameCommerce', 'businessName', 'tuName', 'description']) || id,
      nivel: this.nivelNodoDesdeApi(nodo),
      levelType: this.numeroNodo(nodo, ['levelType', 'idAffiliationLevel', 'idAffilationLevel']),
      idSirio: this.valorNodo(nodo, ['idSirio', 'sirioId', 'entitySonID']),
      nodeID: id,
      commerceGuid: this.valorNodo(nodo, ['commerceGuid', 'guid', 'commerceID']),
      hijos: hijos.length ? hijos : undefined
    };
  }

  private arbolPlanoPorProfundidad(nodosApi: ArbolNodoApi[]): NodoProspecto[] {
    const raiz: NodoProspecto[] = [];
    const pila: NodoProspecto[] = [];
    nodosApi.forEach((nodoApi, index) => {
      const nodo = this.nodoDesdeApi(nodoApi, index);
      if (!nodo) return;
      const profundidad = Math.max(0, this.numeroNodo(nodoApi, ['depth']));
      const padre = profundidad > 0 ? pila[profundidad - 1] : undefined;
      if (padre) padre.hijos = [...(padre.hijos ?? []), nodo];
      else raiz.push(nodo);
      pila[profundidad] = nodo;
      pila.length = profundidad + 1;
    });
    return raiz;
  }

  private listaNodosArbol(valor: unknown): ArbolNodoApi[] {
    if (Array.isArray(valor)) return valor.filter(this.esNodoArbolApi);
    if (!valor || typeof valor !== 'object') return [];
    const data = valor as ArbolNodoApi;
    for (const llave of ['children', 'childs', 'nodes', 'tree', 'items', 'content']) {
      const hijos = data[llave];
      if (Array.isArray(hijos)) return hijos.filter(this.esNodoArbolApi);
    }
    if (Array.isArray(data.data)) return data.data.filter(this.esNodoArbolApi);
    if (data.data && typeof data.data === 'object') return this.listaNodosArbol(data.data);
    return this.esNodoArbolApi(data) ? [data] : [];
  }

  private hijosNodosArbol(nodo: ArbolNodoApi): ArbolNodoApi[] {
    for (const llave of ['children', 'childs', 'nodes', 'tree', 'items', 'content']) {
      const hijos = nodo[llave];
      if (Array.isArray(hijos)) return hijos.filter(this.esNodoArbolApi);
    }
    if (Array.isArray(nodo.data)) return nodo.data.filter(this.esNodoArbolApi);
    return [];
  }

  private esNodoArbolApi(valor: unknown): valor is ArbolNodoApi {
    return !!valor && typeof valor === 'object';
  }

  private valorNodo(nodo: ArbolNodoApi, llaves: string[]): string {
    for (const llave of llaves) {
      const valor = nodo[llave];
      if (valor !== undefined && valor !== null && String(valor).trim()) return String(valor).trim();
    }
    return '';
  }

  private numeroNodo(nodo: ArbolNodoApi, llaves: string[]): number {
    const valor = Number(this.valorNodo(nodo, llaves));
    return Number.isFinite(valor) ? valor : 0;
  }

  private nivelNodoDesdeApi(nodo: ArbolNodoApi): NodoProspecto['nivel'] {
    const levelType = this.numeroNodo(nodo, ['levelType', 'idAffiliationLevel', 'idAffilationLevel']);
    if (levelType === 3) return 'sub-afiliado';
    if (levelType === 4) return 'entidad';
    if (levelType === 5) return 'sucursal';
    if (levelType === 6) return 'caja';
    const nivel = this.normalizar(this.valorNodo(nodo, ['idAffiliationLevel', 'idAffilationLevel', 'level', 'type', 'nodeType']));
    if (nivel.includes('SUB')) return 'sub-afiliado';
    if (nivel.includes('ENTIDAD') || nivel.includes('ENTITY')) return 'entidad';
    if (nivel.includes('SUCURSAL') || nivel.includes('TERMINAL')) return 'sucursal';
    if (nivel.includes('CAJA') || nivel.includes('USER')) return 'caja';
    return 'sucursal';
  }

  private buscarPrimerNodoAccesos(nodos: NodoProspecto[]): NodoProspecto | undefined {
    for (const nodo of nodos) {
      const nivel = this.normalizar(nodo.nivel);
      if (!nivel.includes('CAJA') && !nivel.includes('TERMINAL')
        && (nivel.includes('SUB AFILIADO') || nivel.includes('ENTIDAD') || nivel.includes('SUCURSAL') || nodo.hijos?.length)) return nodo;
      const hijo = this.buscarPrimerNodoAccesos(nodo.hijos ?? []);
      if (hijo) return hijo;
    }
    return undefined;
  }

  private codigoCatalogo(valor: unknown): number | null {
    if (valor === null || valor === undefined || String(valor).trim() === '') return null;
    const codigo = Number(valor);
    return Number.isFinite(codigo) ? codigo : null;
  }

  private actualizarValidadoresAccesos(): void {
    if (!this.nodoRequiereAccesos) {
      Object.keys(this.accesosForm.controls).forEach(key => {
        const control = this.accesosForm.get(key);
        control?.clearValidators();
        control?.updateValueAndValidity({ emitEvent: false });
      });
      this.accesosForm.updateValueAndValidity({ emitEvent: false });
      return;
    }
    const activos = new Set(this.usuariosAcceso.map(usuario => usuario.prefijo as PrefijoAcceso));
    const campos = ['Nombre', 'Paterno', 'Materno', 'Correo', 'ConfirmarCorreo', 'Telefono'] as const;
    const prefijos: PrefijoAcceso[] = ['admin', 'fac', 'tkt', 'controlador', 'supervisor'];

    prefijos.forEach(prefijo => {
      campos.forEach(campo => {
        const control = this.accesosForm.get(`${prefijo}${campo}`);
        if (!control) return;

        if (!activos.has(prefijo)) {
          control.clearValidators();
          if (campo === 'Correo' || campo === 'ConfirmarCorreo') control.setValidators([Validators.email]);
        } else if (campo === 'Correo' || campo === 'ConfirmarCorreo') {
          control.setValidators([Validators.required, Validators.email]);
        } else if (campo === 'Telefono') {
          control.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
        } else {
          control.setValidators([Validators.required, Validators.pattern(/\S/)]);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });

    for (const usuario of this.usuariosAcceso) {
      if (this.perfilesEnviadosPorNodo[this.nodoSeleccionado]?.includes(this.perfilAcceso(usuario.prefijo))) this.bloquearAccesoEnviado(usuario.prefijo);
    }
    this.asegurarUsuarioActivo();
    this.accesosForm.updateValueAndValidity({ emitEvent: false });
  }

  private asegurarUsuarioActivo(): void {
    const usuarios = this.usuariosAcceso.map(usuario => usuario.prefijo);
    if (!usuarios.includes(this.usuarioActivo)) this.usuarioActivo = usuarios[0] || 'admin';
  }

  private guardarAccesosNodoActual(): void {
    if (!this.nodoSeleccionado || !this.nodoRequiereAccesos) return;
    this.accesosPorNodo[this.nodoSeleccionado] = this.accesosForm.getRawValue();
  }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[-_]+/g, ' ');
  }

  private valorTexto(valor: unknown): string {
    if (typeof valor === 'string') return valor.trim();
    if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
    return '';
  }
}
