import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { RegistroClienteComponent } from './registroCliente.component';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';

const ref = '11111111-1111-4111-8111-111111111111';
const progress = { rootStatus: 35, selectedApproved: true, nextRef: null, canRegister: true, nodes: [] };
describe('Popups de operaciones documentales internas', () => {
  let c: RegistroClienteComponent;
  let internal: any;
  let refresh: jasmine.Spy;
  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({ ref }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }] });
    c = TestBed.runInInjectionContext(() => new RegistroClienteComponent()); internal = c;
    TestBed.inject(HttpTestingController).expectOne(`/api/comercios/${ref}/contexto`).flush({ success: true,
      commerce: { ref, status: '30', nameCommerce: 'Comercio' }, navigation: {}, capabilities: {} });
    c.nodoSeleccionado = ref;
    c.documentosProspecto = [{ ref: 'doc-ref', status: 'APPROVED' } as any];
    c.emailNotificacionMesaDigital = 'cliente@example.test';
    c.observacionesClienteMesaDigital = 'Revisar documentación';
    Object.assign(internal, { actaNodo: `${ref}:${ref}`, actaConsultada: `${ref}:${ref}`, actaPermitida: true, actaStatus: 30 });
    c.textoActa = 'Información del acta';
    spyOnProperty(c, 'puedeRevisarDocumentosBff').and.returnValue(true);
    spyOnProperty(c, 'puedeNotificarBff').and.returnValue(true);
    spyOnProperty(c, 'mostrarRegistrarClienteDocumentos').and.returnValue(true);
    spyOnProperty(c, 'puedeFinalizarDocumentosBff').and.returnValue(true);
    spyOnProperty(c, 'esProspectoAdminBff').and.returnValue(false);
    refresh = spyOn(internal, 'refrescarEstadoDocumentalBff');
    spyOn(internal, 'consultarInformacionActa');
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const operations = [
    { label: 'Guardar revisión', service: 'guardarRevisionNodo', run: (c: RegistroClienteComponent) => c.guardarRevisionDocumentos(), success: { success: true, reviewProgress: progress }, md: true },
    { label: 'Guardar Borrador', service: 'guardarRevisionNodo', run: (c: RegistroClienteComponent) => c.guardarRevisionDocumentos(), success: { success: true }, md: false },
    { label: 'Guardar información', service: 'avanzarRevisionActa', run: (c: RegistroClienteComponent) => c.guardarInformacionActa(), success: { success: true, informationSaved: true, statusChanged: false }, md: false },
    { label: 'Enviar Notificación', service: 'enviarObservacionesNodo', run: (c: RegistroClienteComponent) => c.enviarNotificacionMesaDigital(), success: { success: true }, md: false },
    { label: 'Registrar Cliente', service: 'registrarNodo', run: (c: RegistroClienteComponent) => c.registrarClienteProspecto(), success: { success: true }, md: false },
    { label: 'Registrar', service: 'registrarRevisionMD', run: (c: RegistroClienteComponent) => c.continuarRevisionMD(), success: { success: true, idStatus: 31 }, md: true },
  ];
  for (const op of operations) for (const result of ['success', 'business', 'http', 'exception']) {
    it(`${op.label}: carga real, bloqueo y resultado ${result}`, () => {
      spyOnProperty(c, 'flujoRevisionMD').and.returnValue(op.md);
      spyOnProperty(c, 'accionRevisionMD').and.returnValue('Registrar');
      const pending = new Subject<any>();
      const service = spyOn(internal.contextoService, op.service);
      if (result === 'exception') service.and.throwError('Excepción síncrona');
      else service.and.returnValue(pending);
      op.run(c);
      if (result !== 'exception') {
        expect(c.procesandoRevisionDocumental).toBeTrue();
        expect(c.modalRegistro.visible).toBeFalse();
        op.run(c); c.enviarNotificacionMesaDigital(); c.guardarInformacionActa();
        expect(service).toHaveBeenCalledTimes(1);
        if (result === 'http') pending.error({ status: 502, error: {} });
        else { pending.next(result === 'success' ? op.success : { success: false }); pending.complete(); }
      }
      expect(c.procesandoRevisionDocumental).toBeFalse();
      expect(c.modalRegistro.visible).toBeTrue();
      expect(c.modalRegistro.tipo).toBe(result === 'success' ? 'success' : 'error');
      expect(c.guardandoActa || c.guardandoRevisionDocumentos || c.registrandoCliente || c.enviandoNotificacionMesaDigital).toBeFalse();
    });
  }
  it('mantiene la carga hasta finalizar la consulta consecutiva y conserva el resultado parcial', () => {
    const save = new Subject<any>(), context = new Subject<any>();
    spyOn(internal.contextoService, 'guardarRevisionNodo').and.returnValue(save);
    spyOn(internal.contextoService, 'consultarContexto').and.returnValue(context);
    refresh.and.callThrough();
    c.guardarRevisionDocumentos();
    save.error({ status: 502, error: { code: 'COMERCIOS_REVIEW_PARTIALLY_COMPLETED' } });
    expect(c.procesandoRevisionDocumental).toBeTrue();
    context.error({ status: 502 });
    expect(c.procesandoRevisionDocumental).toBeFalse();
    expect(c.modalRegistro.tipo).toBe('error');
    expect(c.modalRegistro.mensaje).toContain('La revisión se guardó, pero');
  });
  it('registro encadenado: revisión, registro y consulta mantienen el mismo bloqueo', () => {
    (Object.getOwnPropertyDescriptor(c, 'esProspectoAdminBff')!.get as jasmine.Spy).and.returnValue(true);
    const save = new Subject<any>(), register = new Subject<any>(), context = new Subject<any>();
    spyOn(internal.contextoService, 'guardarRevisionNodo').and.returnValue(save);
    spyOn(internal.contextoService, 'registrarNodo').and.returnValue(register);
    spyOn(internal.contextoService, 'consultarContexto').and.returnValue(context);
    refresh.and.callThrough();
    spyOn(internal, 'consultarDocumentosProspecto');
    c.registrarClienteProspecto();
    save.next({ success: true }); save.complete();
    expect(c.procesandoRevisionDocumental).toBeTrue();
    register.next({ success: true }); register.complete();
    expect(c.procesandoRevisionDocumental).toBeTrue();
    context.next({ success: true, commerce: { ref } }); context.complete();
    expect(c.procesandoRevisionDocumental).toBeFalse();
    expect(c.modalRegistro.tipo).toBe('success');
  });
  it('conserva el mensaje parcial del acta aunque falle la consulta posterior', () => {
    const save = new Subject<any>(), read = new Subject<any>();
    spyOn(internal.contextoService, 'avanzarRevisionActa').and.returnValue(save);
    spyOn(internal.contextoService, 'consultarInformacionActa').and.returnValue(read);
    internal.consultarInformacionActa.and.callThrough();
    refresh.and.callFake(() => internal.consultarInformacionActa());
    c.guardarInformacionActa();
    save.error({ status: 502, error: { code: 'COMERCIOS_ACTA_PARTIALLY_COMPLETED' } });
    expect(c.procesandoRevisionDocumental).toBeTrue();
    read.error({ status: 502 });
    expect(c.procesandoRevisionDocumental).toBeFalse();
    expect(c.modalRegistro.mensaje).toContain('El texto fue almacenado');
    expect(c.modalRegistro.tipo).toBe('error');
  });
  it('una validación previa fallida no inicia la carga ni envía solicitudes', () => {
    c.textoActa = '';
    const save = spyOn(internal.contextoService, 'avanzarRevisionActa');
    c.guardarInformacionActa();
    expect(save).not.toHaveBeenCalled(); expect(c.procesandoRevisionDocumental).toBeFalse();
  });
  it('el hijo nunca representa los nombres e identificadores de documentos pendientes', () => {
    const fixture = TestBed.createComponent(StepDocumentosComponent);
    fixture.componentInstance.mostrarMesaDigital = true;
    fixture.componentInstance.flujoRevisionMD = true;
    fixture.componentInstance.pendientesRevisionMD = 'ALMACENES KON: documentos 1, 2, 3, 10; IMPALA: documentos 1, 2';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('ALMACENES KON: documentos');
    expect(fixture.nativeElement.textContent).not.toContain('IMPALA: documentos');
  });
});
