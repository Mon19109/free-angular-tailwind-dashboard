import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Validators } from '@angular/forms';
import { PreRegistroComponent } from './preRegistro.component';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { PreRegistroService } from '../../services/preregistro.service';
import { PreregistroAvanceService } from '../../services/preregistro-avance.service';

describe('Preregistro: iconos y pantalla final existente', () => {
  let fixture: ComponentFixture<PreRegistroComponent>;
  let component: PreRegistroComponent;
  let c: any;
  let api: jasmine.SpyObj<PreregistroAvanceService>;
  beforeEach(() => {
    sessionStorage.removeItem('kashpay.preregistro.avance.v1');
    api = jasmine.createSpyObj('avance', ['crear', 'consultar', 'actualizar', 'subirDocumentos']);
    TestBed.configureTestingModule({ imports: [PreRegistroComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: RegimenFiscalService, useValue: { getAllOptions: () => of([]) } },
      { provide: PreRegistroService, useValue: { getTiposComercio: () => of([]) } },
      { provide: PreregistroAvanceService, useValue: api },
    ] });
    fixture = TestBed.createComponent(PreRegistroComponent);
    component = fixture.componentInstance; c = component;
    spyOn(c, 'guardarBorradorSilencioso');
    fixture.detectChanges();
  });
  for (const title of ['Se registró correctamente', 'Documentos guardados correctamente', 'Se actualizó correctamente']) {
    it(`muestra palomita verde para ${title}`, () => {
      c.confirmarAvance(title, 'Comercio de prueba');
      fixture.detectChanges();
      const icon = fixture.nativeElement.querySelector('.result-modal-icon');
      expect(icon.classList.contains('fa-check-circle')).toBeTrue();
      expect(icon.classList.contains('success')).toBeTrue();
      expect(getComputedStyle(icon).color).toBe('rgb(34, 197, 94)');
      expect(icon.classList.contains('error')).toBeFalse();
      expect(fixture.nativeElement.querySelector('#preregistro-result-title').textContent).toBe(title);
    });
  }
  it('el estado real determina el icono, no el texto, y un error conserva la X roja', () => {
    c.confirmarAvance('Operación confirmada', 'Comercio');
    c.mostrarErrorPreRegistro('Se registró correctamente');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('.result-modal-icon');
    expect(icon.classList.contains('fa-times-circle')).toBeTrue();
    expect(icon.classList.contains('error')).toBeTrue();
    expect(getComputedStyle(icon).color).toBe('rgb(239, 68, 68)');
    expect(icon.classList.contains('success')).toBeFalse();
  });
  function prepararUltimaCaja(paquete: string) {
    const node = (id: string, nivel: string, hijos: any[] = []) => ({ id, nivel, nombre: id, ruta: id, hijos });
    const box = node('caja-final', 'caja');
    const branch = node('sucursal-1', 'sucursal', [box]);
    const entity = node('entidad-1', 'entidad', [branch]);
    c.arbolRegistrado = [paquete === 'individual' ? branch : paquete === 'empresa-holding' ? node('sub-afiliado-1', 'sub-afiliado', [entity]) : entity];
    component.tipoNegocioSeleccionado = { id: paquete === 'individual' ? 'comercio-unico' : paquete } as any;
    component.prospectoCreado = true;
    component.arbolNegocioForm.controls.nodoSeleccionado.setValue(box.id);
    c.guidsRegistrados = { [box.id]: 'guid-confirmado-por-el-bff' };
    spyOn(c, 'guardarCapturaNodoActual');
    spyOn(c, 'guardarDocumentosNodoActual');
    spyOn(c, 'nodoActualTieneDatosCompletos').and.returnValue(true);
    spyOnProperty(component, 'mostrarCuentaLiquidacion').and.returnValue(false);
    spyOnProperty(component, 'mostrarPasoDocumentos').and.returnValue(false);
    spyOnProperty(component, 'documentosVisibles').and.returnValue([]);
    const nodes = c.nodosCapturablesParaFlujo();
    c.guidsRegistrados = Object.fromEntries(nodes.map((n: any) => [n.id, 'guid-confirmado-' + n.id]));
    component.arbolNegocioForm.controls.nodosGuardados.setValue(JSON.stringify(nodes.map((n: any) => n.id)));
    component.arbolNegocioForm.controls.nodosCompletados.setValue(JSON.stringify(nodes.map((n: any) => n.id)));
    return nodes;
  }
  for (const paquete of ['individual', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`finaliza ${paquete} tras actualización exitosa de última caja y OK, sin alta nueva`, () => {
      prepararUltimaCaja(paquete);
      const response = new Subject<{ success: boolean }>();
      api.actualizar.and.returnValue(response);
      c.guardarCajaRegistrada();
      expect(component.registroTerminado).toBeFalse();
      response.next({ success: true });
      expect(component.registroTerminado).toBeFalse();
      expect(component.resultadoPreRegistroExitoso).toBeTrue();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.result-modal-ok') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.registroTerminado).toBeTrue();
      expect(fixture.nativeElement.querySelector('.success-card').textContent).toContain('Tu preregistro quedó enviado');
      expect(fixture.nativeElement.querySelector('.success-card').textContent).toContain('Mesa Digital revisará la documentación en aproximadamente 72 horas hábiles.');
      expect(api.crear).not.toHaveBeenCalled();
      expect(api.actualizar).toHaveBeenCalledTimes(1);
    });
  }
  it('no finaliza si otro nodo no tiene sus pasos terminados y guardados', () => {
    const nodes = prepararUltimaCaja('empresa-holding');
    component.arbolNegocioForm.controls.nodosCompletados.setValue(JSON.stringify(nodes.filter((n: any) => n.id !== nodes[1].id).map((n: any) => n.id)));
    api.actualizar.and.returnValue(of({ success: true }));
    c.guardarCajaRegistrada(); component.cerrarModalResultadoPreRegistro();
    expect(component.registroTerminado).toBeFalse();
  });
  it('no finaliza si la última caja tiene un paso inválido', () => {
    prepararUltimaCaja('individual');
    c.nodoActualTieneDatosCompletos.and.returnValue(false);
    api.actualizar.and.returnValue(of({ success: true }));
    c.guardarCajaRegistrada(); component.cerrarModalResultadoPreRegistro();
    expect(component.registroTerminado).toBeFalse();
  });
  it('no finaliza después de una actualización rechazada', () => {
    prepararUltimaCaja('individual');
    api.actualizar.and.returnValue(of({ success: false }));
    c.guardarCajaRegistrada();
    component.finalizarRegistro();
    component.cerrarModalResultadoPreRegistro();
    expect(component.resultadoPreRegistroExitoso).toBeFalse();
    expect(component.registroTerminado).toBeFalse();
  });
  it('vuelve a comprobar los pendientes al cerrar la confirmación', () => {
    const nodes = prepararUltimaCaja('sucursales-multiples');
    api.actualizar.and.returnValue(of({ success: true }));
    c.guardarCajaRegistrada();
    component.arbolNegocioForm.controls.nodosCompletados.setValue(JSON.stringify(nodes.filter((n: any) => n.id !== nodes[0].id).map((n: any) => n.id)));
    component.cerrarModalResultadoPreRegistro();
    expect(component.registroTerminado).toBeFalse();
  });
  for (const nivel of ['entidad', 'sucursal', 'caja']) {
    it(`marca ${nivel} únicamente tras guardado confirmado y conserva las marcas anteriores`, () => {
      const nodes = prepararUltimaCaja('empresa-holding');
      const node = nodes.find((n: any) => n.nivel === nivel);
      component.arbolNegocioForm.controls.nodoSeleccionado.setValue(node.id);
      c.guidsRegistrados[node.id] = 'guid-confirmado';
      c.invalidarGuardadoNodo(node.id);
      const anteriores = c.obtenerNodosCompletados();
      spyOn(c, 'formularioCompleto').and.returnValue(true);
      spyOn(c, 'datosActualizacion').and.returnValue({ nameCommerce: node.nombre });
      spyOn(c, 'guardarDatosSucursalActual'); spyOn(c, 'guardarComercioNodoActual');
      spyOn(c, 'avanzarDespuesDeDatos');
      const response = new Subject<{ success: boolean }>(); api.actualizar.and.returnValue(response);
      component.continuarDatos();
      expect(component.nodoArbolCompletado(node.id)).toBeFalse();
      response.next({ success: true });
      expect(component.nodoArbolCompletado(node.id)).toBeTrue();
      expect(c.obtenerNodosCompletados()).toEqual(jasmine.arrayContaining(anteriores));
      expect(api.crear).not.toHaveBeenCalled();
    });
  }
  it('no confunde formulario válido y navegación con confirmación del servicio', () => {
    prepararUltimaCaja('individual');
    c.invalidarGuardadoNodo('caja-final');
    c.restaurarAvanceNodo(c.buscarNodoArbol('caja-final'));
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
    component.finalizarRegistro();
    expect(component.mensajeResultadoPreRegistro).toContain('guardado de datos pendiente de confirmación');
    expect(component.registroTerminado).toBeFalse();
  });
  it('un error no marca el nodo aunque todos sus campos sean válidos', () => {
    prepararUltimaCaja('individual');
    api.actualizar.and.returnValue(of({ success: false })); c.guardarCajaRegistrada();
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
  });
  it('revoca la marca al editar datos y no la recupera solo por navegar', () => {
    prepararUltimaCaja('individual');
    component.datosForm.controls.correo.markAsDirty();
    component.datosForm.controls.correo.setValue('correo-invalido');
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
    c.nodoActualTieneDatosCompletos.and.returnValue(false);
    c.restaurarAvanceNodo(c.buscarNodoArbol('caja-final'));
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
  });
  it('no permite que formularios del nodo actual invaliden marcas de nodos anteriores', () => {
    const nodes = prepararUltimaCaja('empresa-holding');
    c.nodoActualTieneDatosCompletos.and.returnValue(false);
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
    for (const node of nodes.filter((n: any) => n.id !== 'caja-final')) expect(component.nodoArbolCompletado(node.id)).toBeTrue();
  });
  it('conserva confirmaciones y nombres documentales por nodo al guardar y recuperar el borrador', () => {
    prepararUltimaCaja('individual');
    c.documentosPorNodo = { 'sucursal-1': { 1: { archivoNombre: 'fiscal.pdf' } }, 'caja-final': {} };
    c.confirmarGuardadoNodo('sucursal-1', true);
    c.guardarBorradorSilencioso.and.callThrough(); c.guardarBorradorSilencioso();
    const guardados = component.arbolNegocioForm.controls.nodosGuardados.value;
    const completados = component.arbolNegocioForm.controls.nodosCompletados.value;
    component.arbolNegocioForm.controls.nodosGuardados.setValue('[]');
    component.arbolNegocioForm.controls.nodosCompletados.setValue('[]'); c.documentosPorNodo = {};
    c.cargarBorrador();
    expect(component.arbolNegocioForm.controls.nodosGuardados.value).toBe(guardados);
    expect(component.arbolNegocioForm.controls.nodosCompletados.value).toBe(completados);
    expect(c.documentosPorNodo['sucursal-1'][1].archivoNombre).toBe('fiscal.pdf');
    localStorage.removeItem(c.draftKey);
  });

  it('valida únicamente campos obligatorios habilitados', () => {
    for (const control of Object.values(component.datosForm.controls)) {
      control.clearValidators(); control.updateValueAndValidity({ emitEvent: false });
    }
    component.datosForm.clearValidators();
    const control = component.datosForm.controls.nombre;
    control.setValue(''); control.setValidators(Validators.required); control.disable();
    expect(c.formularioCompleto(component.datosForm)).toBeTrue();
    control.enable(); expect(c.formularioCompleto(component.datosForm)).toBeFalse();
  });
  it('no completa con documentos seleccionados hasta que la carga sea confirmada', () => {
    prepararUltimaCaja('individual');
    const file = new File(['%PDF-1.7'], 'documento.pdf', { type: 'application/pdf' });
    (Object.getOwnPropertyDescriptor(component, 'documentosVisibles')!.get as jasmine.Spy).and.returnValue([
      { numero: 1, nombre: 'Documento obligatorio', obligatorio: true, archivo: file, archivoNombre: file.name },
    ]);
    const response = new Subject<{ success: boolean }>(); api.subirDocumentos.and.returnValue(response);
    component.finalizarRegistro();
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
    response.next({ success: false });
    expect(component.nodoArbolCompletado('caja-final')).toBeFalse();
    component.cerrarModalResultadoPreRegistro(); expect(component.registroTerminado).toBeFalse();
    api.subirDocumentos.and.returnValue(of({ success: true })); component.finalizarRegistro();
    expect(component.nodoArbolCompletado('caja-final')).toBeTrue();
    component.cerrarModalResultadoPreRegistro(); expect(component.registroTerminado).toBeTrue();
    expect(api.crear).not.toHaveBeenCalled();
  });
  it('recorrer y volver a entidad y sucursal conserva sus palomitas confirmadas', () => {
    const nodes = prepararUltimaCaja('sucursales-multiples');
    c.guidsRegistrados = Object.fromEntries(nodes.map((n: any) => [n.id, 'guid-' + n.id]));
    for (const node of [nodes[0], nodes[1], nodes[2], nodes[0]]) {
      component.seleccionarNodoArbol(node);
      for (const previous of nodes) expect(component.nodoArbolCompletado(previous.id)).withContext(previous.id).toBeTrue();
    }
  });

  it('una marca antigua sin confirmación del guardado no permite finalizar', () => {
    const nodes = prepararUltimaCaja('individual');
    component.arbolNegocioForm.controls.nodosGuardados.setValue('["caja-final"]');
    expect(component.nodoArbolCompletado(nodes[0].id)).toBeFalse();
    expect(c.primerNodoPendienteArbol().id).toBe(nodes[0].id);
  });
  it('recupera la liquidación propia de cada nodo sin usar la del siguiente', () => {
    const nodes = prepararUltimaCaja('sucursales-multiples');
    (Object.getOwnPropertyDescriptor(component, 'mostrarCuentaLiquidacion')!.get as jasmine.Spy).and.returnValue(true);
    c.guardarCapturaNodoActual.and.callThrough();
    component.seleccionarNodoArbol(nodes[0]);
    component.liquidacionForm.controls.cuentaClabe.setValue('000000000000000001');
    component.seleccionarNodoArbol(nodes[1]);
    component.liquidacionForm.controls.cuentaClabe.setValue('000000000000000002');
    component.seleccionarNodoArbol(nodes[0]);
    expect(component.liquidacionForm.controls.cuentaClabe.value).toBe('000000000000000001');
    component.seleccionarNodoArbol(nodes[1]);
    expect(component.liquidacionForm.controls.cuentaClabe.value).toBe('000000000000000002');
  });

});
