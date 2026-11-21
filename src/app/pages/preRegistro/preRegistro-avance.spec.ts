import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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
  const route = { snapshot: { queryParamMap: convertToParamMap({}) } };
  const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
  const catalogos = {
    'Sub Afiliado': [{ id: 31, nombre: 'Empresa Holding' }],
    Entidad: [{ id: 41, nombre: 'Empresa Grupo' }, { id: 42, nombre: 'Persona Física' }, { id: 43, nombre: 'Entidad Agrupadora con auditor' }],
    Sucursal: [{ id: 51, nombre: 'Sucursales Únicas' }, { id: 52, nombre: 'Sucursales de Grupo' }],
    Caja: [{ id: 61, nombre: 'Cuenta Terminal Pin Rapido' }],
  };
  const configurar = (id: string) => {
    component.tipoNegocioSeleccionado = new TiposNegocioComponent().tiposNegocio.find(tipo => tipo.id === id);
    const root = component.arbolNegocioWizard[0];
    const nivel = c.nivelClientePorNodo(root);
    const tipoComercio = id === 'auditor-unico' ? 'Entidad Agrupadora con auditor' : (catalogos as any)[nivel][0].nombre;
    component.arbolNegocioForm.controls.nodoSeleccionado.setValue(root.id, { emitEvent: false });
    component.comercioForm.patchValue({ nivel, tipoComercio, tipoComercioId: c.typeOfBusinessPorTipoComercio[tipoComercio] }, { emitEvent: false });
    component.datosForm.controls.nombreComercial.setValue('Raíz capturada', { emitEvent: false });
    return root;
  };
  const raizPayload = (payload: any, id: string) => id === 'empresa-holding' ? payload : id === 'comercio-unico' ? payload.entitys[0].branchOficces[0] : payload.entitys[0];
  beforeEach(() => {
    route.snapshot.queryParamMap = convertToParamMap({});
    router.navigate.calls.reset();
    sessionStorage.removeItem('kashpay.preregistro.avance.v1');
    api = jasmine.createSpyObj('avance', ['crear', 'consultar', 'actualizar', 'subirDocumentos']);
    api.actualizar.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: route }, { provide: Router, useValue: router },
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
    c.tiposComercioCatalogoPorNivel = structuredClone(catalogos);
    c.typeOfBusinessPorTipoComercio = Object.fromEntries(Object.values(catalogos).flat().map(tipo => [tipo.nombre, tipo.id]));
    configurar('comercio-unico');
    Object.values(component.datosForm.controls).forEach(control => { control.clearValidators(); control.updateValueAndValidity({ emitEvent: false }); });
    component.datosForm.clearValidators(); component.datosForm.updateValueAndValidity({ emitEvent: false });
  });
  afterEach(() => { sessionStorage.removeItem('kashpay.preregistro.avance.v1'); TestBed.inject(HttpTestingController).verify(); });
  for (const id of ['comercio-unico', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`envía el árbol ${id} sin exigir capturas secundarias ni documentos`, () => {
      const root = configurar(id);
      const pending = new Subject<any>(); api.crear.and.returnValue(pending);
      component.continuarDatos(); component.continuarDatos();
      expect(api.crear).toHaveBeenCalledTimes(1);
      const args = api.crear.calls.mostRecent().args;
      expect(args[2][0].id).toBe(root.id);
      expect(args[2][0].hijos!.length).toBeGreaterThan(0);
      expect(raizPayload(args[3], id).nameCommerce).toBe('Raíz capturada');
      const recorrer = (value: any): void => {
        if (value.nameCommerce) expect(value.commerceAddress.map((a: any) => a.addressType)).toEqual(['DF', 'DC']);
        for (const address of value.commerceAddress || []) {
          expect(address.commerceAddressID).toBeNull();
          expect(address.commerceID).toBeNull();
        }
        for (const key of ['entitys', 'branchOficces', 'poss']) (value[key] || []).forEach((child: any) => {
          expect(child.typeOfBusiness).toBeGreaterThan(0); recorrer(child);
        });
      };
      recorrer(raizPayload(args[3], id));
      expect(component.enviandoPreRegistro).toBeTrue();
      expect(component.mostrarModalResultadoPreRegistro).toBeFalse();
    });
  }
  it('impide enviar si falta el catálogo de cajas, antes de marcar el intento', () => {
    delete c.tiposComercioCatalogoPorNivel.Caja;
    component.continuarDatos();
    expect(api.crear).not.toHaveBeenCalled();
    expect(c.altaIntentada).toBeFalse();
    expect(component.mensajeResultadoPreRegistro).toContain('tipo de comercio');
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
    c.confirmarGuardadoNodo('sucursal-1');
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
  for (const paquete of ['sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`calcula Únicas/Grupo por entidad y recalcula al cambiar cantidades: ${paquete}`, () => {
      configurar(paquete); c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
      const alta1 = c.construirRegistroInicial();
      const entidad1 = paquete === 'empresa-holding' ? alta1.payloadCompleto.entitys[0] : alta1.payloadCompleto.entitys[0];
      expect(entidad1.branchOficces[0].typeOfBusiness).toBe(51);
      component.arbolNegocioForm.controls.sucursalesPorEntidad.setValue('[2]');
      const alta2 = c.construirRegistroInicial();
      expect(alta2.payloadCompleto.entitys[0].branchOficces.length).toBe(2);
      expect(alta2.payloadCompleto.entitys[0].branchOficces.every((branch: any) => branch.typeOfBusiness === 52)).toBeTrue();
      component.arbolNegocioForm.controls.sucursalesPorEntidad.setValue('[1]');
      expect(c.construirRegistroInicial().payloadCompleto.entitys[0].branchOficces[0].typeOfBusiness).toBe(51);
    });
  }
  it('respeta un tipo de sucursal seleccionado explícitamente que pertenece al catálogo', () => {
    const root = configurar('sucursales-multiples');
    c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
    const branch = root.hijos![0];
    const saved = c.obtenerComercioPorNodo();
    saved[branch.id] = { nivel: 'Sucursal', tipoComercio: 'Sucursales de Grupo', tipoComercioId: 52, afiliacionComisionista: '' };
    component.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(saved));
    c.tiposElegidosPorNodo.add(branch.id);
    expect(c.construirRegistroInicial().payloadCompleto.entitys[0].branchOficces[0].typeOfBusiness).toBe(52);
  });
  for (const paquete of ['comercio-unico', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`conserva todos los campos POS y nombres iniciales, sin modificar el nombre editable: ${paquete}`, () => {
      configurar(paquete); c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
      const branch = c.aplanarArbolNegocio(component.arbolNegocioWizard).find((node: any) => node.nivel === 'sucursal');
      component.renombrarNodoArbol(branch.hijos[0].id, 'Nombre para edición posterior');
      const alta = c.construirRegistroInicial();
      const recorrer = (value: any): void => {
        (value.poss || []).forEach((pos: any, index: number) => expect(pos).toEqual({
          commerceAddress: ['DF', 'DC'].map(addressType => ({ ...c.construirDireccionPayload(addressType, {}, addressType === 'DF' ? '' : 'Comercial'), commerceAddressID: null, commerceID: null })),
          nameCommerce: `CAJA ${String(index + 1).padStart(2, '0')}`, name: `CAJA ${String(index + 1).padStart(2, '0')}`,
          paternalSurname: 'ND', maternalSurname: 'ND', password: '', liquidationLevel: '0', dispersionAccount: 'CONC_ADQUI', isAliasUser: true, typeOfBusiness: 61,
        }));
        for (const key of ['entitys', 'branchOficces']) (value[key] || []).forEach(recorrer);
      };
      recorrer(alta.payloadCompleto);
      expect(c.buscarNodoArbol(branch.hijos[0].id).nombre).toBe('Nombre para edición posterior');
    });
  }
  it('conserva datos propios de cada nodo, no hereda RFC y omite contacto principal de sucursales', () => {
    const root = configurar('sucursales-multiples');
    const branch = root.hijos![0];
    component.datosForm.patchValue({ rfc: 'RAIZ-FICTICIA', tipoPersona: 'PM' }, { emitEvent: false });
    c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
    const data = c.obtenerDatosPorSucursal();
    data[branch.id] = { nombreComercial: 'Sucursal capturada', rfc: 'SUCURSAL-FICTICIA', tipoPersona: 'PF', correo: 'sucursal@example.invalid', telefono: '0000000000' };
    component.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(data));
    const alta = c.construirRegistroInicial(), entity = alta.payloadCompleto.entitys[0], branchPayload = entity.branchOficces[0];
    expect(entity.rfc).toBe('RAIZ-FICTICIA'); expect(entity.typePerson).toBe('PM');
    expect(branchPayload.rfc).toBe('SUCURSAL-FICTICIA'); expect(branchPayload.typePerson).toBe('PF');
    expect(branchPayload.nameCommerce).toBe('Sucursal capturada');
    expect(branchPayload.email).toBe(''); expect(branchPayload.phoneNumber).toBe('');
    expect(branchPayload.poss[0].rfc).toBeUndefined();
    expect(entity.referrerNodeId).toBeUndefined();
  });
  it('alta: conserva direcciones capturadas de la caja sin copiar las de su sucursal', () => {
    const root = configurar('comercio-unico');
    c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
    const data = c.obtenerDatosPorSucursal();
    data[root.id].nombreVialidad = 'Calle de sucursal';
    data[root.hijos![0].id] = { nombreVialidad: 'Fiscal de caja', nombreVialidadComercial: 'Comercial de caja' };
    component.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(data));
    const branch = c.construirRegistroInicial().payloadCompleto.entitys[0].branchOficces[0];
    expect(branch.commerceAddress[0].roadName).toBe('Calle de sucursal');
    expect(branch.poss[0].commerceAddress.map((a: any) => a.roadName)).toEqual(['Fiscal de caja', 'Comercial de caja']);
    expect(branch.poss[0].commerceAddress.every((a: any) => a.commerceID === null && a.commerceAddressID === null)).toBeTrue();
  });
  it('alta: padre capturado, hijo vacío e hijo capturado conservan domicilios independientes', () => {
    const root = configurar('sucursales-multiples');
    component.arbolNegocioForm.controls.sucursalesPorEntidad.setValue('[2]', { emitEvent: false });
    c.guardarDatosSucursalActual(); c.guardarComercioNodoActual();
    const branches = component.arbolNegocioWizard[0].hijos!;
    const campos = ['codigoPostal', 'tipoVialidad', 'nombreVialidad', 'numeroExterior', 'numeroInterior', 'colonia', 'localidad', 'municipio', 'entidadFederativa', 'entreCalle', 'yCalle', 'locationID'];
    const datos = c.obtenerDatosPorSucursal();
    const captura = (nombre: string) => Object.fromEntries(campos.flatMap(campo => [[campo, nombre + '-DF-' + campo], [campo + 'Comercial', nombre + '-DC-' + campo]]));
    datos[root.id] = { ...datos[root.id], ...captura('padre') };
    datos[branches[0].id] = {};
    datos[branches[1].id] = captura('hijo');
    component.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(datos));
    const entity = c.construirRegistroInicial().payloadCompleto.entitys[0];
    const esperado = (data: any) => ['DF', 'DC'].map(tipo => ({ ...c.construirDireccionPayload(tipo, data, tipo === 'DF' ? '' : 'Comercial'), commerceAddressID: null, commerceID: null }));
    expect(entity.commerceAddress).toEqual(esperado(datos[root.id]));
    expect(entity.branchOficces[0].commerceAddress).toEqual(esperado({}));
    expect(entity.branchOficces[1].commerceAddress).toEqual(esperado(datos[branches[1].id]));
    for (const branch of entity.branchOficces) expect(branch.poss[0].commerceAddress).toEqual(esperado({}));
  });
  it('el enlace nuevo descarta solo almacenamiento de Preregistro y no consulta el comprobante anterior', () => {
    route.snapshot.queryParamMap = convertToParamMap({ nuevo: '1' });
    sessionStorage.setItem('kashpay.preregistro.avance.v1', 'a'.repeat(64));
    localStorage.setItem('kashpay.preregistro.draft.v1', '{}');
    localStorage.setItem('kashpay.preregistro.payload.v1', '{}');
    sessionStorage.setItem('otra-funcionalidad-test', 'conservar');
    component.ngOnInit();
    expect(api.consultar).not.toHaveBeenCalled(); expect(api.crear).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('kashpay.preregistro.avance.v1')).toBeNull();
    expect(localStorage.getItem('kashpay.preregistro.draft.v1')).toBeNull();
    expect(localStorage.getItem('kashpay.preregistro.payload.v1')).toBeNull();
    expect(sessionStorage.getItem('otra-funcionalidad-test')).toBe('conservar');
    sessionStorage.removeItem('otra-funcionalidad-test');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { nuevo: null }, replaceUrl: true }));
    component.continuarAfiliacion();
    const req = TestBed.inject(HttpTestingController).expectOne(environment.preregistroBff.validarAfiliacionUrl);
    req.flush({ success: true, comprobante: 'b'.repeat(64) });
    expect(c.comprobanteAfiliacion).toBe('b'.repeat(64));
    expect(c.altaIntentada).toBeFalse();
  });
  it('recupera normalmente el avance del comprobante actual', () => {
    sessionStorage.setItem('kashpay.preregistro.avance.v1', 'a'.repeat(64));
    spyOn(c, 'cargarBorrador');
    const arbol = component.arbolNegocioWizard;
    api.consultar.and.returnValue(of({ success: true, comercioCreado: true, estado: 'creado', tipoNegocio: 'individual', arbol, guidsPorNodo: { [arbol[0].id]: 'guid-confirmado' } }));
    component.ngOnInit();
    expect(api.consultar).toHaveBeenCalledWith('a'.repeat(64));
    expect(component.prospectoCreado).toBeTrue(); expect(c.guidsRegistrados[arbol[0].id]).toBe('guid-confirmado');
    expect(api.crear).not.toHaveBeenCalled();
  });
  for (const code of ['PREREGISTRO_RESULTADO_PENDIENTE', 'PREREGISTRO_AVANCE_NO_DISPONIBLE', undefined]) {
    it(`un 410 ${code} no permite reenviar el mismo comprobante`, () => {
      sessionStorage.setItem('kashpay.preregistro.avance.v1', 'a'.repeat(64));
      spyOn(c, 'cargarBorrador');
      api.consultar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 410, error: { code } })));
      component.ngOnInit(); component.continuarDatos();
      expect(c.altaIntentada).toBeTrue(); expect(api.crear).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('kashpay.preregistro.avance.v1')).toBe('a'.repeat(64));
    });
  }
  it('un comprobante sin alta confirmado por el BFF vuelve a validación real de afiliación', () => {
    sessionStorage.setItem('kashpay.preregistro.avance.v1', 'a'.repeat(64));
    spyOn(c, 'cargarBorrador');
    api.consultar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 410, error: { code: 'PREREGISTRO_SIN_ALTA' } })));
    component.ngOnInit();
    expect(c.altaIntentada).toBeFalse(); expect(component.pasoActual).toBe(0);
    expect(component.mostrarModalResultadoPreRegistro).toBeFalse();
    expect(c.comprobanteAfiliacion).toBe(''); expect(api.crear).not.toHaveBeenCalled();
    component.continuarAfiliacion();
    TestBed.inject(HttpTestingController).expectOne(environment.preregistroBff.validarAfiliacionUrl).flush({ success: false, message: 'Afiliación rechazada por el proveedor' });
    expect(component.errorAfiliacion).toContain('Afiliación rechazada');
    expect(c.comprobanteAfiliacion).toBe('');
  });
  it('permite corregir una validación previa del BFF cuando confirma que no se envió el alta', () => {
    api.crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { altaEnviada: false, message: 'Catálogo vencido' } })));
    component.continuarDatos();
    expect(c.altaIntentada).toBeFalse(); expect(sessionStorage.getItem('kashpay.preregistro.avance.v1')).toBeNull();
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
