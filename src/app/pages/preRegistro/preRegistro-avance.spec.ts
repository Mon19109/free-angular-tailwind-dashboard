import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';
import { PreRegistroComponent } from './preRegistro.component';
import { TiposNegocioComponent } from './components/tipos-negocio/tipos-negocio.component';
import { PreregistroAvanceService } from '../../services/preregistro-avance.service';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { PreRegistroService } from '../../services/preregistro.service';
import { SKIP_AUTH_TOKEN } from '../../services/auth-token.interceptor';
import { environment } from '../../environments/environments';

describe('Preregistro: alta inicial y continuación aislada', () => {
  let component: PreRegistroComponent;
  let c: any;
  let api: jasmine.SpyObj<PreregistroAvanceService>;
  beforeEach(() => {
    sessionStorage.removeItem('kashpay.preregistro.avance.v1');
    api = jasmine.createSpyObj('avance', ['crear', 'consultar', 'actualizar', 'subirDocumentos']);
    api.actualizar.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ChangeDetectorRef, useValue: { detectChanges() {} } },
      { provide: RegimenFiscalService, useValue: { getAllOptions: () => of([]) } },
      { provide: PreRegistroService, useValue: { getTiposComercio: () => of([]) } },
      { provide: PreregistroAvanceService, useValue: api },
    ] });
    component = TestBed.runInInjectionContext(() => new PreRegistroComponent()); c = component;
    spyOn(c, 'guardarBorradorSilencioso');
    spyOn(c, 'datosActualizacion').and.returnValue({ nameCommerce: 'Raíz capturada' });
    spyOn(c, 'avanzarDespuesDeDatos');
    c.comprobanteAfiliacion = 'a'.repeat(64);
    c.afiliacionValidada = component.afiliacionForm.controls.afiliacion.value;
    component.tipoNegocioSeleccionado = new TiposNegocioComponent().tiposNegocio[0];
    component.arbolNegocioForm.controls.nodoSeleccionado.setValue('sucursal-1');
    Object.values(component.datosForm.controls).forEach(control => { control.clearValidators(); control.updateValueAndValidity({ emitEvent: false }); });
    component.datosForm.clearValidators(); component.datosForm.updateValueAndValidity({ emitEvent: false });
  });
  afterEach(() => { sessionStorage.removeItem('kashpay.preregistro.avance.v1'); TestBed.inject(HttpTestingController).verify(); });
  for (const id of ['comercio-unico', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`envía el árbol ${id} sin exigir capturas secundarias ni documentos`, () => {
      component.tipoNegocioSeleccionado = new TiposNegocioComponent().tiposNegocio.find(tipo => tipo.id === id);
      const root = component.arbolNegocioWizard[0];
      component.arbolNegocioForm.controls.nodoSeleccionado.setValue(root.id);
      const pending = new Subject<any>(); api.crear.and.returnValue(pending);
      component.continuarDatos(); component.continuarDatos();
      expect(api.crear).toHaveBeenCalledTimes(1);
      const args = api.crear.calls.mostRecent().args;
      expect(args[2][0].id).toBe(root.id);
      expect(args[2][0].hijos!.length).toBeGreaterThan(0);
      expect(args[3]).toEqual({ nameCommerce: 'Raíz capturada' });
      expect(component.enviandoPreRegistro).toBeTrue();
      expect(component.mostrarModalResultadoPreRegistro).toBeFalse();
    });
  }
  it('construye datos reales de raíz aunque las cajas no tengan catálogo ni datos', () => {
    c.datosActualizacion.and.callThrough();
    component.comercioForm.patchValue({ tipoComercio: 'Sucursales Únicas', tipoComercioId: 99 });
    component.datosForm.controls.nombreComercial.setValue('Raíz real capturada');
    api.crear.and.returnValue(new Subject<any>());
    component.continuarDatos();
    const args = api.crear.calls.mostRecent().args;
    expect(args[3]['nameCommerce']).toBe('Raíz real capturada');
    expect(args[3]['typeOfBusiness']).toBe(99);
    expect(args[3]['password']).toBeUndefined();
    expect(args[3]['poss']).toBeUndefined();
    expect(args[2][0].hijos![0].nombre).toBeTruthy();
  });
  it('tras alta incierta consulta el estado y no repite creación', () => {
    api.crear.and.returnValue(throwError(() => new Error('timeout')));
    api.consultar.and.returnValue(new Subject<any>());
    component.continuarDatos(); component.continuarDatos();
    expect(api.crear).toHaveBeenCalledTimes(1);
    expect(api.consultar).toHaveBeenCalledWith('a'.repeat(64));
  });
  it('bloquea alta con datos inválidos de raíz', () => {
    component.datosForm.setErrors({ required: true });
    component.continuarDatos(); expect(api.crear).not.toHaveBeenCalled();
  });
  it('conserva nombres personalizados y predeterminados con formularios vacíos', () => {
    const root = component.arbolNegocioWizard[0];
    component.renombrarNodoArbol(root.hijos![0].id, 'Caja personalizada');
    c.actualizarNombreSucursalDesdeDatos(root.id, {});
    expect(component.arbolNegocioWizard[0].nombre).toBe(root.nombre);
    expect(component.arbolNegocioWizard[0].hijos![0].nombre).toBe('Caja personalizada');
  });
  it('confirma alta, conserva GUID de caja y luego actualiza sin repetir POST', () => {
    const arbol = component.arbolNegocioWizard;
    const guids = { [arbol[0].id]: 'root-guid', [arbol[0].hijos![0].id]: 'box-guid' };
    api.crear.and.returnValue(of({ success: true, comercioCreado: true, estado: 'creado', tipoNegocio: 'individual', arbol, guidsPorNodo: guids }));
    component.continuarDatos();
    expect(component.prospectoCreado).toBeTrue();
    expect(c.guidsRegistrados).toEqual(guids);
    expect(component.registroTerminado).toBeFalse();
    expect(component.tituloResultadoPreRegistro).toBe('Se registró correctamente');
    spyOn(c, 'formularioCompleto').and.returnValue(true);
    component.continuarDatos();
    expect(api.actualizar).toHaveBeenCalled(); expect(api.crear).toHaveBeenCalledTimes(1);
  });
  it('conserva la captura tras error de actualización y permite reintentar', () => {
    component.prospectoCreado = true; c.comprobanteAvance = 'a'.repeat(64); c.guidsRegistrados = { 'sucursal-1': 'real-guid' };
    component.datosForm.controls.nombreComercial.setValue('Dato conservado');
    api.actualizar.and.returnValue(throwError(() => new Error('rechazado')));
    component.continuarDatos();
    expect(component.datosForm.controls.nombreComercial.value).toBe('Dato conservado');
    expect(component.enviandoPreRegistro).toBeFalse();
    api.actualizar.and.returnValue(of({ success: true })); component.continuarDatos();
    expect(api.actualizar).toHaveBeenCalledTimes(2); expect(api.crear).not.toHaveBeenCalled();
  });
  it('finalizar nunca crea de nuevo y permite subir documentos después', () => {
    component.prospectoCreado = true; c.comprobanteAvance = 'a'.repeat(64); c.guidsRegistrados = { 'sucursal-1': 'real-guid' };
    const file = new File(['%PDF-1.7'], 'doc.pdf', { type: 'application/pdf' });
    spyOnProperty(component, 'documentosVisibles').and.returnValue([{ numero: 1, archivo: file }] as any);
    spyOn(c, 'guardarCapturaNodoActual'); spyOn(c, 'guardarDocumentosNodoActual');
    spyOn(c, 'avanzarASiguienteSucursal').and.returnValue(false);
    api.subirDocumentos.and.returnValue(of({ success: true }));
    component.finalizarRegistro();
    expect(api.subirDocumentos).toHaveBeenCalledWith('a'.repeat(64), [{ nodoId: 'sucursal-1', numeroDocumento: '1', file }]);
    expect(api.crear).not.toHaveBeenCalled();
  });
  it('conserva los datos al cambiar de nodo y recuperarlos', () => {
    component.datosForm.controls.nombreComercial.setValue('Raíz conservada');
    c.guardarDatosSucursalActual();
    const root = component.arbolNegocioWizard[0], box = root.hijos![0];
    component.seleccionarNodoArbol(box);
    component.seleccionarNodoArbol(root);
    expect(component.datosForm.controls.nombreComercial.value).toBe('Raíz conservada');
  });
});

describe('Adaptador HTTP exclusivo de Preregistro', () => {
  it('omite autenticación interna, usa el comprobante y nunca envía un Bearer o GUID elegido por Angular', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(PreregistroAvanceService), http = TestBed.inject(HttpTestingController);
    service.actualizar('a'.repeat(64), 'caja-1', { nameCommerce: 'Caja personalizada' }).subscribe();
    const req = http.expectOne(`${environment.preregistroBff.registroCompletoUrl}/avance/nodos/caja-1`);
    expect(req.request.context.get(SKIP_AUTH_TOKEN)).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('X-Preregistro-Comprobante')).toBe('a'.repeat(64));
    expect(req.request.body).toEqual({ datos: { nameCommerce: 'Caja personalizada' } });
    req.flush({ success: true }); http.verify();
  });
});
