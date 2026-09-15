import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
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
import { finalize } from 'rxjs';
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

type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type PrefijoAcceso = 'admin' | 'fac' | 'tkt' | 'controlador' | 'supervisor';

interface NodoProspecto {
  id: string;
  nombre: string;
  nivel: 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' | string;
  idSirio?: string;
  nodeID?: string;
  commerceGuid?: string;
  hijos?: NodoProspecto[];
}

@Component({
  selector: 'app-registro-prospecto-cliente',
  standalone: true,
  imports: [
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
export class RegistroProspectoClienteComponent implements OnInit {
  readonly prospectoBearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
  private readonly fb = inject(FormBuilder);
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
      descripcion: 'para sucursal agrupadora controladora.',
      icono: 'fa-solid fa-user-shield'
    },
    {
      prefijo: 'supervisor',
      titulo: 'Usuario Supervisor de Terminales',
      descripcion: 'para sucursal agrupadora supervisora.',
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
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', Validators.required],
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
  mensaje = '';
  pasoActivo: 'liquidacion' | 'accesos' = 'liquidacion';
  prospecto: ProspectoCliente | null = null;
  cuentaComercio: Record<string, unknown> | null = null;
  arbol: NodoProspecto[] = [];
  nodoSeleccionado = '';
  usuarioActivo = 'admin';
  cargandoCuenta = false;
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

    this.liquidacionForm.controls.cuentaFueraRed.valueChanges
      .subscribe(() => {
        this.actualizarEstadoLiquidacion();
        this.actualizarValidadoresAccesos();
      });
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

    if (!this.link) {
      this.cargando = false;
      this.error = 'El link no contiene token para validar el registro.';
      return;
    }

    this.cargarProspecto();
  }

  validarTokenSms(): void {
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
    this.tokenValue = '';
    this.tokenErrorMessage = 'Debes validar el token enviado por SMS para continuar.';
  }

  continuarLiquidacion(): void {
    this.mensaje = '';
    this.pasoActivo = 'accesos';
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

  private asignarArchivoLiquidacion(archivo: File | null, tipo: 'carta' | 'edc'): void {
    if (!archivo) return;

    if (tipo === 'carta') {
      this.cartaLiquidacionArchivo = archivo;
      this.cartaLiquidacionArchivoNombre = archivo?.name ?? '';
      return;
    }

    this.caratulaEdcArchivo = archivo;
    this.caratulaEdcArchivoNombre = archivo?.name ?? '';
  }

  volverLiquidacion(): void {
    this.mensaje = '';
    this.pasoActivo = 'liquidacion';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalizar(): void {
    this.mensaje = '';
    this.error = '';
    this.liquidacionForm.markAllAsTouched();
    this.accesosForm.markAllAsTouched();

    this.guardarAccesosNodoActual();

    if (this.liquidacionForm.invalid || this.accesosForm.invalid) {
      this.error = 'Completa los campos obligatorios para enviar el registro.';
      return;
    }

    this.guardando = true;
    this.prospectoService.guardarCapturaCliente({
      prospectId: this.prospectId,
      link: this.link,
      liquidacion: this.liquidacionForm.getRawValue(),
      accesos: this.accesosPorNodo
    }).pipe(
      finalize(() => this.guardando = false)
    ).subscribe({
      next: () => {
        this.mensaje = 'Información enviada correctamente.';
      },
      error: () => {
        this.error = 'No fue posible guardar la información. Verifica el endpoint de guardado del prospecto.';
      }
    });
  }

  private cargarProspecto(): void {
    this.cargando = true;
    this.error = '';

    this.prospectoService.obtenerProspecto(this.prospectId, this.link).pipe(
      finalize(() => this.cargando = false)
    ).subscribe({
      next: resp => {
        this.prospecto = resp?.accountResponse ?? null;
        this.precargarDatosProspecto();
        if (this.tokenSmsValidado) this.consultarCuentaComercio();
      },
      error: () => {
        this.error = 'No fue posible validar el link del prospecto.';
      }
    });
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
    this.consultarDocumentos(this.texto(datos['commerceID'] || datos['commerceId'] || datos['commerceGuid'] || this.prospecto?.id));
    if (this.liquidacionForm.controls.beneficiarioIgualComercio.value) {
      this.sincronizarBeneficiarioDesdeComercio();
    }
  }

  private sincronizarBeneficiarioDesdeComercio(): void {
    const direccion = this.datosForm.getRawValue();
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
      correoBeneficiario: this.texto(direccion.correo),
      direccionBeneficiario: direccionCompleta,
      rfcBeneficiario: this.texto(direccion.rfc),
      actividadBeneficiario: this.texto(direccion.actividad || direccion.descripcionGiro),
      giroBeneficiario: this.texto(direccion.giroComercial || direccion.descripcionGiro)
    }, { emitEvent: false });
    this.actualizarValidadoresBeneficiario(esMoral ? 'moral' : 'fisica');
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
      giroBeneficiario: ''
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
    this.documentosService.consultarDocumentos(commerceId, this.prospectoBearerToken).pipe(
      finalize(() => this.cargandoDocumentos = false)
    ).subscribe({
      next: respuesta => this.documentosProspecto = respuesta.legalDocuments || respuesta.documents || [],
      error: () => this.documentosProspecto = []
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
      this.documentosService.consultarUrlArchivo(documento.s3Key, this.prospectoBearerToken).subscribe(url => window.open(url, '_blank', 'noopener'));
      return;
    }
    if (documento.archivoUrl) window.open(documento.archivoUrl, '_blank', 'noopener');
  }

  seleccionarNodo(id: string): void {
    this.guardarAccesosNodoActual();
    this.nodoSeleccionado = id;
    const accesos = this.accesosPorNodo[id];
    this.accesosForm.reset();
    if (accesos) this.accesosForm.patchValue(accesos, { emitEvent: false });
    this.asegurarUsuarioActivo();
    this.actualizarValidadoresAccesos();
  }

  get usuariosAcceso(): UsuarioAccesoConfig[] {
    if (!this.nodoRequiereAccesos) return [];
    if (this.esSucursalAgrupadora) return this.usuariosAgrupadora;
    if (this.liquidacionForm.controls.cuentaFueraRed.value === 'otros-bancos-en-red') return this.usuariosFacTkt;
    return this.usuariosBase;
  }

  get contextoSirio(): string {
    return this.texto(this.cuentaComercio?.['idSirio'])
      || this.texto(this.prospecto?.['idSirio'])
      || this.texto(this.prospecto?.id)
      || this.prospectId
      || 'ND';
  }

  get contextoNombre(): string {
    return this.texto(this.cuentaComercio?.['nameCommerce'])
      || this.texto(this.cuentaComercio?.['businessName'])
      || this.texto(this.prospecto?.nameCommerce)
      || this.texto(this.prospecto?.businessName)
      || 'Comercio';
  }

  get contextoNivel(): string {
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
    this.actualizarValidadoresAccesos();
  }

  private actualizarValidadoresBeneficiario(tipo: TipoPersonaBeneficiario): void {
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

  private consultarCuentaComercio(): void {
    const sirioId = this.texto(this.prospecto?.['idSirio'])
      || this.texto(this.prospecto?.id)
      || this.prospectId;
    if (!sirioId) return;

    this.cargandoCuenta = true;
    this.cuentaComercioService.consultarCuenta(sirioId, this.obtenerBearerConsulta()).pipe(
      finalize(() => this.cargandoCuenta = false)
    ).subscribe({
      next: respuesta => {
        this.cuentaComercio = this.extraerCuenta(respuesta);
        this.cargarFormulariosDesdeGet();
        this.arbol = this.construirArbol();
        this.nodoSeleccionado = this.arbol[0]?.id || '';
        this.precargarBeneficiarioDesdeComercio();
        this.consultarArbolReal();
      },
      error: () => {
        this.cuentaComercio = null;
      }
    });
  }

  private extraerCuenta(respuesta: unknown): Record<string, unknown> {
    if (!respuesta || typeof respuesta !== 'object') return {};
    const objeto = respuesta as Record<string, unknown>;
    const candidatos = [objeto['entityInfo'], objeto['account'], objeto['data'], objeto];
    return candidatos.find(item => item && typeof item === 'object') as Record<string, unknown> || {};
  }

  private obtenerBearerConsulta(): string {
    if (this.link) return this.prospectoBearerToken;

    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Usa las llaves individuales como respaldo.
    }

    return localStorage.getItem('token')
      || localStorage.getItem('auth_token')
      || this.prospectoBearerToken;
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

  private consultarArbolReal(): void {
    const nodeID = this.valorTexto(this.cuentaComercio?.['nodeID'])
      || this.valorTexto(this.cuentaComercio?.['nodeId'])
      || this.valorTexto(this.prospecto?.['nodeID'])
      || this.valorTexto(this.prospecto?.['nodeId'])
      || this.valorTexto(this.cuentaComercio?.['id'])
      || this.valorTexto(this.cuentaComercio?.['idTerminal'])
      || this.valorTexto(this.prospecto?.['idTerminal'])
      || this.prospectId;
    if (!nodeID) return;

    this.cargandoArbol = true;
    this.errorArbol = '';
    this.arbolNodosService.obtenerArbol(nodeID, this.link ? this.prospectoBearerToken : undefined).pipe(
      finalize(() => this.cargandoArbol = false)
    ).subscribe({
      next: respuesta => {
        const arbol = this.nodosDesdeArbol(respuesta);
        if (!arbol.length) return;
        this.arbol = arbol;
        const primerNivelAccesos = this.buscarPrimerNodoAccesos(this.arbol) || this.arbol[0];
        this.nodoSeleccionado = primerNivelAccesos.id;
        this.seleccionarNodo(this.nodoSeleccionado);
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

  private precargarBeneficiarioDesdeComercio(): void {
    if (!this.liquidacionForm.controls.beneficiarioIgualComercio.value) return;
    this.liquidacionForm.patchValue({
      nombreBeneficiario: this.texto(this.cuentaComercio?.['businessName']) || this.contextoNombre,
      correoBeneficiario: this.texto(this.cuentaComercio?.['email']) || this.texto(this.prospecto?.email),
      direccionBeneficiario: this.texto(this.cuentaComercio?.['commerceAddress']),
      rfcBeneficiario: this.texto(this.cuentaComercio?.['rfc']),
      actividadBeneficiario: this.texto(this.cuentaComercio?.['activityDescription']),
      giroBeneficiario: this.texto(this.cuentaComercio?.['bussinesLineDescription'])
    }, { emitEvent: false });
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
          control.setValidators([Validators.required]);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });

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
