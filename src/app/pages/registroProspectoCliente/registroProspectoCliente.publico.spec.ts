import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ProspectoClienteService } from '../../services/prospecto-cliente.service';
import { SeguimientoNavigationService } from '../../services/seguimiento-navigation.service';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Seguimiento público: documentos y registro por nodo', () => {
  let c: RegistroProspectoClienteComponent;
  let api: jasmine.SpyObj<SeguimientoProspectoService>;
  let prospecto: jasmine.SpyObj<ProspectoClienteService>;
  let navigation: jasmine.SpyObj<SeguimientoNavigationService>;
  const root = '10000000-0000-4000-8000-000000000001';
  const child = '10000000-0000-4000-8000-000000000002';
  const document = { ref: '10000000-0000-4000-8000-000000000003', name: 'Constancia fiscal', documentType: 'CSF', status: 'APPROVED' };

  beforeEach(() => {
    api = jasmine.createSpyObj('seguimiento', ['consultarCuenta', 'consultarArbol', 'consultarLiquidacionNodo', 'consultarDocumentos', 'guardarDispersionEnRed', 'guardarLiquidacion', 'guardarAccesos', 'completar', 'renovarAcceso', 'subirDocumentoNodo']);
    prospecto = jasmine.createSpyObj('prospecto', ['obtenerProspecto', 'validarTokenSms']);
    navigation = jasmine.createSpyObj('navigation', ['restartForNavigation']);
    navigation.restartForNavigation.and.returnValue(of(undefined));
    prospecto.obtenerProspecto.and.returnValue(of({ success: true, accountResponse: {}, smsValidated: false }));
    api.consultarCuenta.and.returnValue(of({ success: true, entityInfo: {} }));
    api.consultarArbol.and.returnValue(of({ success: true, nodes: [
      { ref: root, name: 'Entidad', levelType: 4, depth: 0 },
      { ref: child, name: 'Sucursal', levelType: 5, depth: 1 }
    ] }));
    api.consultarLiquidacionNodo.and.returnValue(of({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: null, cuentaCLConfirmada: null, hasPlatformAccess: false }));
    api.subirDocumentoNodo.and.returnValue(of({success:true}));
    api.consultarDocumentos.and.returnValue(of({ success: true, documents: [document] }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: ActivatedRoute, useValue: {} },
      { provide: SeguimientoProspectoService, useValue: api }, { provide: ProspectoClienteService, useValue: prospecto },
      { provide: SeguimientoNavigationService, useValue: navigation }] });
    c = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    c.link = 'fixture-link';
    c.cargando = false;
    c.showTokenModal = false;
    (c as any).tokenSmsValidado = true;
    spyOn(window, 'scrollTo');
  });

  it('retira el enlace de la dirección y las consultas siguientes utilizan el contexto', () => {
    const original = window.location.href;
    const originalState = window.history.state;
    try {
      window.history.replaceState(originalState, '', '/registro-prospecto/fixture-link?link=fixture-link');
      (c as any).cargarProspecto();
      expect(window.location.pathname).toBe('/registro-prospecto');
      expect(window.location.search).toBe('');
      (c as any).cargarProspecto();
      expect(prospecto.obtenerProspecto.calls.argsFor(0)[1]).toBe('fixture-link');
      expect(prospecto.obtenerProspecto.calls.argsFor(1)[1]).toBe('');
    } finally { window.history.replaceState(originalState, '', original); }
  });

  it('no envía archivos si falta SMS o el nodo seleccionado es Caja', () => {
    load();
    const event = () => ({archivo: new File(['fixture'], 'file.pdf', {type: 'application/pdf'}), documento: {numero: 1, nombre: 'Documento', obligatorio: false}});
    (c as any).tokenSmsValidado = false;
    c.subirDocumentoPublico(event());
    (c as any).tokenSmsValidado = true;
    (c as any).arbol = [{id: 'caja', levelType: 6, nivel: 'caja', hijos: []}];
    c.nodoSeleccionado = 'caja';
    c.subirDocumentoPublico(event());
    expect(api.subirDocumentoNodo).not.toHaveBeenCalled();
  });

  function load() { c.consultarCuentaComercio(); }
  function accountNetwork() {
    api.consultarLiquidacionNodo.and.returnValue(of({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: 'NETWORK', cuentaCLConfirmada: null, hasPlatformAccess: false }));
    load();
  }
  function fillAccess() {
    c.accesosForm.patchValue({ adminNombre: 'Nombre', adminPaterno: 'Apellido', adminMaterno: 'Apellido',
      adminCorreo: 'user@example.invalid', adminConfirmarCorreo: 'user@example.invalid', adminTelefono: '5512345678' });
  }

  it('consulta metadatos públicos después de conocer la raíz, sin error global ni archivos privados', () => {
    load();
    expect(c.nodoSeleccionado).toBe(root);
    expect(api.consultarDocumentos).toHaveBeenCalledTimes(1);
    expect(c.error).toBe('');
    expect(c.documentosVisibles[0]).toEqual(jasmine.objectContaining({ nombre: 'Constancia fiscal', archivoId: document.ref, archivoUrl: '', s3Key: '', estatusRevision: 'APPROVED' }));
    expect(c.documentosCargados).toBe(1);
    expect(c.liquidacionCompleta).toBeFalse();
  });

  it('un error temporal de documentos queda en esa sección y permite continuar', () => {
    api.consultarDocumentos.and.returnValue(throwError(() => ({ status: 503 })));
    accountNetwork();
    expect(c.errorDocumentos).toContain('No fue posible consultar');
    expect(c.error).toBe('');
    expect(c.errorProspecto).toBe('');
    expect(c.showTokenModal).toBeFalse();
    c.continuarLiquidacion();
    expect(c.pasoActivo).toBe('accesos');
  });

  it('consulta los documentos de cada nodo por su referencia, sin heredar la raíz', () => {
    load();
    api.consultarDocumentos.and.returnValue(of({success:true, documents:[]}));
    c.seleccionarNodo(child);
    expect(c.documentosDelNodoDisponibles).toBeTrue();
    expect(c.documentosProspecto).toEqual([]);
    expect(api.consultarDocumentos).toHaveBeenCalledWith(child);
    c.seleccionarNodo(root);
    expect(api.consultarDocumentos).toHaveBeenCalledWith(root);
    expect(api.consultarDocumentos).toHaveBeenCalledTimes(3);
  });

  it('rechaza la firma binaria inválida sin enviar el archivo', async () => {
    load();
    await c.subirDocumentoPublico({ archivo: new File(['not-pdf'], 'file.pdf', { type: 'application/pdf' }),
      documento: { numero: 1, nombre: 'Documento', obligatorio: false } });
    expect(api.subirDocumentoNodo).not.toHaveBeenCalled();
    expect(c.mensajeDocumentoPublico).toContain('contenido');
    expect(c.subiendoDocumentoPublico).toBeFalse();
  });

  it('sube archivo al nodo seleccionado y reconsulta sin aprobarlo ni reiniciar liquidación', async () => {
    load(); c.seleccionarNodo(child);
    const file = new File(['%PDF-1.4'], 'documento.pdf', {type:'application/pdf'});
    await c.subirDocumentoPublico({archivo: file, documento: {numero: 1, nombre: 'Documento', obligatorio: false}});
    expect(api.subirDocumentoNodo).toHaveBeenCalledWith(child,1,file);
    expect(api.consultarDocumentos).toHaveBeenCalledWith(child);
    expect(c.documentosVisibles[0].estatusRevision).toBe('APPROVED'); // Only the mocked backend status, never changed by upload.
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
    expect(navigation.restartForNavigation).not.toHaveBeenCalled();
  });

  it('ignora documentos de una consulta anterior incluso después de volver al mismo nodo', () => {
    const old = new Subject<any>();
    const current = new Subject<any>();
    api.consultarDocumentos.and.returnValues(old, of({success:true,documents:[]}), current);
    load();
    c.seleccionarNodo(child);
    c.seleccionarNodo(root);
    old.next({ success: true, documents: [document] }); old.complete();
    expect(c.documentosProspecto).toEqual([]);
    expect(c.cargandoDocumentos).toBeTrue();
    current.next({ success: true, documents: [{ ...document, name: 'Actual' }] }); current.complete();
    expect(c.documentosVisibles[0].nombre).toBe('Actual');
    expect(c.cargandoDocumentos).toBeFalse();
  });

  it('bloquea la visualización pública aunque se le pase una URL privada', () => {
    const open = spyOn(window, 'open');
    c.verDocumentoProspecto({ numero: 1, nombre: 'Archivo', obligatorio: true, archivoUrl: 'https://private.invalid/file', s3Key: 'private/file' });
    expect(open).not.toHaveBeenCalled();
    expect(c.error).toBe('');
    expect(c.errorDocumentos).toContain('aún no están disponibles');
  });

  it('cambiar de sección con liquidación pendiente nunca registra ni abre accesos', () => {
    load();
    c.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    c.alternarSeccionFinal('accesos');
    expect(c.pasoActivo).toBe('liquidacion');
    expect(c.modalLiquidacion).toBeNull();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
  });

  it('una liquidación confirmada abre accesos sin repetir registros', () => {
    accountNetwork();
    expect(c.pasoActivo).toBe('accesos');
    c.continuarLiquidacion();
    c.alternarSeccionFinal('accesos');
    c.modalLiquidacion = 'en-red'; c.aceptarModalLiquidacion();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
  });

  it('OTHER_BANK sin confirmación de cuenta CL sigue pendiente', () => {
    api.consultarLiquidacionNodo.and.returnValue(of({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: 'OTHER_BANK', cuentaCLConfirmada: null }));
    load();
    expect(c.liquidacionCompleta).toBeFalse();
    expect(c.pasoActivo).toBe('liquidacion');
  });

  it('espera confirmación de dispersión, bloquea doble envío y no cambia el nodo durante el guardado', () => {
    load();
    const saved = new Subject<any>(); api.guardarDispersionEnRed.and.returnValue(saved);
    c.liquidacionForm.controls.cuentaFueraRed.setValue('en-red'); c.modalLiquidacion = 'en-red';
    c.aceptarModalLiquidacion(); c.aceptarModalLiquidacion(); c.seleccionarNodo(child);
    expect(api.guardarDispersionEnRed).toHaveBeenCalledOnceWith(root);
    expect(c.nodoSeleccionado).toBe(root);
    expect(c.liquidacionCompleta).toBeFalse();
    saved.next({ success: true }); saved.complete();
    expect(c.liquidacionCompleta).toBeTrue();
    expect(c.pasoActivo).toBe('accesos');
    expect(prospecto.validarTokenSms).not.toHaveBeenCalled();
    expect(api.renovarAcceso).not.toHaveBeenCalled();
  });

  it('no confirma una dispersión fallida ni solicita otro SMS', () => {
    load(); api.guardarDispersionEnRed.and.returnValue(throwError(() => ({ status: 503 })));
    c.liquidacionForm.controls.cuentaFueraRed.setValue('en-red'); c.modalLiquidacion = 'en-red'; c.aceptarModalLiquidacion();
    expect(c.liquidacionCompleta).toBeFalse();
    expect(c.pasoActivo).toBe('liquidacion');
    expect(c.showTokenModal).toBeFalse();
  });

  it('no deja que la liquidación tardía de la raíz cambie el estado de otra selección', () => {
    const old = new Subject<any>();
    api.consultarLiquidacionNodo.and.returnValues(old, of({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: null, cuentaCLConfirmada: null }));
    load(); c.seleccionarNodo(child);
    old.next({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: 'NETWORK', hasPlatformAccess: true }); old.complete();
    expect(c.nodoSeleccionado).toBe(child);
    expect(c.liquidacionCompleta).toBeFalse();
    expect(c.accesosCompletos).toBeFalse();
  });

  for (const [option, modality] of [['otros-bancos','OTHER_BANK'],['otros-bancos-en-red','OTHER_BANK_AND_NETWORK']])
  it(`registra ${modality} por nodeRef una sola vez y sólo confirma después de la respuesta`, () => {
    load();
    const saved = new Subject<any>(); api.guardarLiquidacion.and.returnValue(saved);
    c.liquidacionForm.patchValue({ cuentaFueraRed: option, idInstitution: 1, idActivity: 2 });
    c.liquidacionForm.disable();
    (c as any).cartaLiquidacionArchivo = new File(['%PDF-1.7'], 'carta.pdf', { type: 'application/pdf' });
    (c as any).caratulaEdcArchivo = new File(['%PDF-1.7'], 'edc.pdf', { type: 'application/pdf' });
    c.continuarLiquidacion(); c.continuarLiquidacion();
    expect(api.guardarLiquidacion).toHaveBeenCalledTimes(1);
    const body = api.guardarLiquidacion.calls.mostRecent().args[0];
    expect(body.get('nodeRef')).toBe(root);
    expect(body.get('dispersionAccount')).toBe(modality);
    expect(body.get('idStatus')).toBeNull();
    expect(JSON.parse(body.get('datosLiquidacion') as string).identifier).toBeUndefined();
    expect(c.liquidacionCompleta).toBeFalse();
    saved.next({ success: true }); saved.complete();
    expect(c.liquidacionCompleta).toBeTrue();
    c.aceptarModalLiquidacion();
    expect(c.pasoActivo).toBe('accesos');
    expect(api.guardarLiquidacion).toHaveBeenCalledTimes(1);
  });

  it('conserva accesos confirmados si falla completar y nunca vuelve a registrarlos', () => {
    accountNetwork(); fillAccess();
    api.guardarAccesos.and.returnValue(of({ success: true, registration: { status: 'COMPLETED' } }));
    api.completar.and.returnValue(throwError(() => ({ status: 503 })));
    c.finalizar();
    expect(c.accesosCompletos).toBeTrue();
    expect(c.registroFinalizado).toBeFalse();
    expect(c.error).toContain('Los accesos están confirmados');
    c.finalizar();
    expect(api.guardarAccesos).toHaveBeenCalledTimes(1);
    expect(api.completar).toHaveBeenCalledTimes(1);
  });

  it('no guarda ni consulta sin validación SMS y rechaza selecciones fuera del árbol', () => {
    load(); c.seleccionarNodo('otro-comercio'); expect(c.nodoSeleccionado).toBe(root);
    (c as any).tokenSmsValidado = false;
    api.consultarCuenta.calls.reset(); api.consultarLiquidacionNodo.calls.reset();
    c.consultarCuentaComercio(); c.continuarLiquidacion(); c.aceptarModalLiquidacion(); c.finalizar();
    expect(api.consultarCuenta).not.toHaveBeenCalled(); expect(api.consultarLiquidacionNodo).not.toHaveBeenCalled();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled(); expect(api.guardarAccesos).not.toHaveBeenCalled();
  });

  it('un rechazo de autorización real bloquea la sesión sin consultas de renovación', () => {
    api.consultarLiquidacionNodo.and.returnValue(throwError(() => ({ status: 403, error: { code: 'SEGUIMIENTO_SCOPE_INVALID' } })));
    load();
    expect(c.errorProspecto).toContain('ya no está vigente');
    expect((c as any).tokenSmsValidado).toBeFalse();
    expect(prospecto.obtenerProspecto).not.toHaveBeenCalled();
    expect(api.renovarAcceso).not.toHaveBeenCalled();
  });

  it('volver desde bfcache inicia otra verificación y descarta datos y respuestas anteriores', () => {
    const oldDocuments = new Subject<any>(); api.consultarDocumentos.and.returnValue(oldDocuments);
    load();
    c.restaurarNavegacionPublica({ persisted: true } as PageTransitionEvent);
    expect(navigation.restartForNavigation).toHaveBeenCalledTimes(1);
    expect(c.showTokenModal).toBeTrue();
    expect((c as any).tokenSmsValidado).toBeFalse();
    oldDocuments.next({ success: true, documents: [document] }); oldDocuments.complete();
    expect(c.documentosProspecto).toEqual([]);
    expect(c.liquidacionCompleta).toBeFalse();
  });
  for (const status of [25, 26]) it(`estatus ${status}: cierra ambas secciones y bloquea envíos directos sin afectar documentos`, () => {
    api.consultarLiquidacionNodo.and.returnValue(of({success:true,status,dispersionAccount:'NETWORK',
      permissions:{editLiquidation:false,editAccess:false},hasPlatformAccess:false}));
    load(); fillAccess();
    expect(c.liquidacionPublicaBloqueada).toBeTrue();
    expect(c.accesosPublicosBloqueados).toBeTrue();
    c.pasoActivo='liquidacion';
    c.alternarSeccionFinal('accesos');
    expect(c.pasoActivo).toBe('liquidacion');
    c.pasoActivo='accesos';c.alternarSeccionFinal('liquidacion');
    expect(c.pasoActivo).toBe('accesos');
    c.continuarLiquidacion();c.modalLiquidacion='en-red';c.aceptarModalLiquidacion();c.finalizar();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
    expect(api.guardarAccesos).not.toHaveBeenCalled();
    expect(api.consultarDocumentos).toHaveBeenCalled();
    expect(c.documentosVisibles.length).toBe(1);
  });

  for (const status of [32, 33]) it(`estatus ${status}: impide otra liquidación y conserva acceso permitido`, () => {
    api.consultarLiquidacionNodo.and.returnValue(of({success:true,status,dispersionAccount:'OTHER_BANK',
      permissions:{editLiquidation:false,editAccess:true},hasPlatformAccess:false}));
    load();
    expect(c.liquidacionPublicaBloqueada).toBeTrue();
    expect(c.accesosPublicosBloqueados).toBeFalse();
    c.continuarLiquidacion();c.modalLiquidacion='en-red';c.aceptarModalLiquidacion();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
  });

  it('sin permisos de BFF no permite capturar aunque el árbol muestre 31', () => {
    api.consultarLiquidacionNodo.and.returnValue(of({success:true,status:31,dispersionAccount:null}));
    load();
    expect(c.liquidacionPublicaBloqueada).toBeTrue();
    expect(c.accesosPublicosBloqueados).toBeTrue();
    c.modalLiquidacion='en-red';c.aceptarModalLiquidacion();c.finalizar();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
    expect(api.guardarAccesos).not.toHaveBeenCalled();
  });

  it('muestra bloqueo y no renderiza formularios públicos en 25/26', () => {
    spyOn(RegistroProspectoClienteComponent.prototype,'ngOnInit').and.stub();
    const fixture=TestBed.createComponent(RegistroProspectoClienteComponent);
    c=fixture.componentInstance;
    c.link='fixture-link';c.cargando=false;c.showTokenModal=false;(c as any).tokenSmsValidado=true;
    for(const status of [25,26]) {
      api.consultarLiquidacionNodo.and.returnValue(of({success:true,status,dispersionAccount:null,
        permissions:{editLiquidation:false,editAccess:false}}));
      load();fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('no están habilitados');
      expect(fixture.nativeElement.querySelector('app-step-liquidacion')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-step-accesos')).toBeNull();
    }
    fixture.destroy();
  });

  it('si el estatus cambia en el proveedor, revoca ambos permisos y no repite solicitudes', () => {
    load();
    api.guardarDispersionEnRed.and.returnValue(throwError(() => ({status:409,error:{code:'SEGUIMIENTO_STATUS_FORBIDDEN'}})));
    c.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');c.modalLiquidacion='en-red';
    c.aceptarModalLiquidacion();c.aceptarModalLiquidacion();c.continuarLiquidacion();c.finalizar();
    expect(api.guardarDispersionEnRed).toHaveBeenCalledTimes(1);
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();expect(api.guardarAccesos).not.toHaveBeenCalled();
    expect(c.liquidacionPublicaBloqueada).toBeTrue();expect(c.accesosPublicosBloqueados).toBeTrue();
  });

  it('en 33 muestra liquidación bancaria confirmada y conserva los accesos pendientes', () => {
    api.consultarLiquidacionNodo.and.returnValue(of({success:true,status:33,dispersionAccount:'OTHER_BANK',
      cuentaCLConfirmada:true,permissions:{editLiquidation:false,editAccess:true},hasPlatformAccess:false}));
    load();
    expect(c.liquidacionCompleta).toBeTrue();expect(c.pasoActivo).toBe('accesos');
    expect(c.liquidacionPublicaBloqueada).toBeTrue();expect(c.accesosPublicosBloqueados).toBeFalse();
    c.modalLiquidacion='en-red';c.aceptarModalLiquidacion();
    expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();expect(api.guardarLiquidacion).not.toHaveBeenCalled();
  });

});
