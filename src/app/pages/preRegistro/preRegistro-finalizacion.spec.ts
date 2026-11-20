import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
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
});
