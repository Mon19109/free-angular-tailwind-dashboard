import { StepLiquidacionComponent } from '../preRegistro/components/liquidacion/step-liquidacion.component';
import { BeneficiariosService } from '../../services/beneficiarios.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { StepAccesosComponent } from '../preRegistro/components/accesos/step-accesos.component';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ProspectoClienteService } from '../../services/prospecto-cliente.service';
import { SeguimientoNavigationService } from '../../services/seguimiento-navigation.service';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Seguimiento: captura Scotiabank', () => {
  let c: RegistroProspectoClienteComponent;
  let api: jasmine.SpyObj<SeguimientoProspectoService>;
  let prospecto: jasmine.SpyObj<ProspectoClienteService>;
  let navigation: jasmine.SpyObj<SeguimientoNavigationService>;
  const root = '10000000-0000-4000-8000-000000000001';
  const child = '10000000-0000-4000-8000-000000000002';
  const document = { ref: '10000000-0000-4000-8000-000000000003', name: 'Constancia fiscal', documentType: 'CSF', status: 'APPROVED' };

  beforeEach(() => {
    api = jasmine.createSpyObj('seguimiento', ['consultarCuenta', 'consultarArbol', 'consultarLiquidacionNodo', 'consultarDocumentos', 'guardarDispersionEnRed', 'guardarLiquidacion', 'guardarAccesos', 'completar', 'renovarAcceso', 'subirDocumentoNodo']);
    prospecto = jasmine.createSpyObj('prospecto', ['obtenerProspecto']);
    navigation = jasmine.createSpyObj('navigation', ['restartForNavigation']);
    navigation.restartForNavigation.and.returnValue(of(undefined));
    prospecto.obtenerProspecto.and.returnValue(of({ success: true, accountResponse: {}, linkAuthorized: true }));
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
    (c as any).enlaceAutorizado = true;
    spyOn(window, 'scrollTo');
  });

  const campos = ['institutionReference', 'aditionalPhone', 'aditionalEmail', 'aditionalEmail2', 'aditionalEmail3'] as const;
  let step: StepLiquidacionComponent;
  beforeEach(() => {
    c.consultarCuentaComercio();
    api.guardarLiquidacion.and.returnValue(of({ success: true }));
    for (const control of Object.values(c.liquidacionForm.controls)) {
      control.clearValidators(); control.updateValueAndValidity({ emitEvent: false });
    }
    c.liquidacionForm.patchValue({ cuentaClabe: '044000000000000000', idActivity: 2 });
    (c as any).cartaLiquidacionArchivo = new File(['%PDF-1.7'], 'carta.pdf', { type: 'application/pdf' });
    (c as any).caratulaEdcArchivo = new File(['%PDF-1.7'], 'edc.pdf', { type: 'application/pdf' });
    step = TestBed.runInInjectionContext(() => new StepLiquidacionComponent());
    step.form = c.liquidacionForm; step.preregistroPublico = true;
    spyOn(TestBed.inject(BeneficiariosService), 'buscarInstitucion').and.returnValue(of({
      institutionResponse: { institutions: [{ key: 1, name: 'SCOTIABANK' }] }
    }) as any);
    step.buscarBanco();
  });
  function adicionales() {
    expect(api.guardarLiquidacion).toHaveBeenCalledTimes(1);
    return JSON.parse(api.guardarLiquidacion.calls.mostRecent().args[0].get('datosLiquidacion') as string).aditionalData;
  }
  it('la búsqueda existente activa cinco inputs y al cambiar CLABE los oculta', () => {
    expect(c.cuentaScotiabank).toBeTrue();
    const fixture = TestBed.createComponent(StepLiquidacionComponent);
    fixture.componentInstance.form = c.liquidacionForm;
    fixture.componentRef.setInput('mostrarDatosScotiabank', c.cuentaScotiabank); fixture.detectChanges();
    for (const campo of campos) expect(fixture.nativeElement.querySelector(`[formControlName="${campo}"]`)).not.toBeNull();
    c.continuarLiquidacion(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Debes llenar este campo.');
    const input = window.document.createElement('input'); input.value = '012000000000000000';
    step.formatearCuenta({ target: input } as unknown as Event);
    expect(c.cuentaScotiabank).toBeFalse();
    fixture.componentRef.setInput('mostrarDatosScotiabank', c.cuentaScotiabank); fixture.detectChanges();
    for (const campo of campos) expect(fixture.nativeElement.querySelector(`[formControlName="${campo}"]`)).toBeNull();
    fixture.destroy();
  });
  it('impide guardar Scotiabank sin referencia', () => {
    c.continuarLiquidacion();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
    expect(c.liquidacionForm.controls.institutionReference.hasError('required')).toBeTrue();
  });
  it('permite solo referencia y conserva las propiedades existentes', () => {
    c.liquidacionForm.controls.institutionReference.setValue('REF capturada'); c.continuarLiquidacion();
    const data = adicionales(); expect(data.institutionReference).toBe('REF capturada');
    for (const campo of campos.slice(1)) expect(data[campo]).toBe('');
    expect(data.currency).toBe('484'); expect(data.aditionalReferences).toEqual(['', '', '']);
  });
  it('envía exactamente los cinco valores capturados', () => {
    const valores = { institutionReference: 'REF-123', aditionalPhone: '5512345678',
      aditionalEmail: 'uno@example.com', aditionalEmail2: 'dos@example.com', aditionalEmail3: 'tres@example.com' };
    c.liquidacionForm.patchValue(valores); c.continuarLiquidacion();
    const data = adicionales(); for (const campo of campos) expect(data[campo]).toBe(valores[campo]);
  });
  for (const campo of ['aditionalEmail', 'aditionalEmail2', 'aditionalEmail3'] as const) {
    it(`rechaza ${campo} con contenido inválido`, () => {
      c.liquidacionForm.patchValue({ institutionReference: 'REF', [campo]: 'correo inválido' }); c.continuarLiquidacion();
      expect(api.guardarLiquidacion).not.toHaveBeenCalled();
      expect(c.liquidacionForm.controls[campo].hasError('email')).toBeTrue();
    });
  }
  for (const cambio of [false, true]) {
    it(`otro banco guarda sin adicionales ni bloqueos (después de Scotiabank: ${cambio})`, () => {
      c.liquidacionForm.controls.aditionalEmail.setValue('dato inválido conservado');
      if (cambio) { c.continuarLiquidacion(); expect(api.guardarLiquidacion).not.toHaveBeenCalled(); }
      c.liquidacionForm.patchValue({ cuentaClabe: '012000000000000000', nombreBanco: 'BBVA', idInstitution: 2 });
      c.continuarLiquidacion(); const data = adicionales();
      for (const campo of campos) expect(data[campo]).toBeUndefined();
      expect(c.liquidacionForm.controls.aditionalEmail.value).toBe('dato inválido conservado');
    });
  }
  it('En Red conserva su operación y no envía los campos Scotiabank', () => {
    c.continuarLiquidacion(); // Referencia pendiente no debe bloquear En Red.
    c.liquidacionForm.controls.cuentaFueraRed.setValue('en-red');
    expect(c.cuentaScotiabank).toBeFalse();
    api.guardarDispersionEnRed.and.returnValue(of({success:true}));
    c.continuarLiquidacion(); c.aceptarModalLiquidacion();
    expect(api.guardarLiquidacion).not.toHaveBeenCalled();
    expect(api.guardarDispersionEnRed).toHaveBeenCalledWith(root);
  });
  it('no activa los campos en el flujo interno ni para modalidades distintas de CLABE', () => {
    c.modoInterno = true; expect(c.cuentaScotiabank).toBeFalse();
    c.modoInterno = false; c.liquidacionForm.controls.tipoCuenta.setValue('TARJETA');
    expect(c.cuentaScotiabank).toBeFalse();
  });
});
