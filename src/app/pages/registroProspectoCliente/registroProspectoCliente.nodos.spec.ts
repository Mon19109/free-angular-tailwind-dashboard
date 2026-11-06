import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';
import { DocumentoSeguimiento, SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';

describe('Seguimiento: consultas independientes por nodo', () => {
  let c: RegistroProspectoClienteComponent;
  let service: jasmine.SpyObj<SeguimientoProspectoService>;
  const documentos = (name: string): { success: true; documents: DocumentoSeguimiento[] } => ({ success: true,
    documents: [{ ref: name, name, documentType: null, status: 'APPROVED' }] });
  const liquidacion = { success: true, dispersionAccount: 'NETWORK', cuentaCLConfirmada: true, hasPlatformAccess: false };
  beforeEach(() => {
    service = jasmine.createSpyObj<SeguimientoProspectoService>('Seguimiento', ['consultarDocumentos', 'consultarLiquidacionNodo', 'consultarCuenta']);
    service.consultarCuenta.and.callFake(ref => of({ success: true, entityInfo: { typePerson: 'PM', businessName: ref, nameCommerce: ref } }));
    service.consultarDocumentos.and.callFake(ref => of(documentos(ref ?? '')));
    service.consultarLiquidacionNodo.and.returnValue(of(liquidacion));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: ActivatedRoute, useValue: {} },
      { provide: SeguimientoProspectoService, useValue: service }] });
    c = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    c.tokenSmsValidado = true; c.nodoSeleccionado = '';
    c.arbol = [{ id: 'entidad', nombre: 'Entidad', nivel: 'entidad', levelType: 4, hijos: [
      { id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal', levelType: 5 },
      { id: 'caja', nombre: 'Caja', nivel: 'caja', levelType: 6 }
    ] }];
  });
  it('entidad → sucursal → caja → entidad vuelve a consultar, sin mezclar documentos', () => {
    for (const id of ['entidad', 'sucursal', 'caja', 'entidad']) {
      c.seleccionarNodo(id);
      expect(c.documentosVisibles[0].nombre).toBe(id);
    }
    expect(service.consultarDocumentos.calls.allArgs()).toEqual([['entidad'], ['sucursal'], ['caja'], ['entidad']]);
    expect(service.consultarLiquidacionNodo.calls.allArgs()).toEqual([['entidad'], ['sucursal'], ['entidad']]);
    expect(c.documentosVisibles[0].estado).toBe('Aprobado');
  });
  it('ignora respuestas anteriores incluso al regresar al mismo nodo', () => {
    const oldDocs = new Subject<{ success: true; documents: DocumentoSeguimiento[] }>();
    const oldSettlement = new Subject<unknown>();
    service.consultarDocumentos.and.returnValue(oldDocs);
    service.consultarLiquidacionNodo.and.returnValue(oldSettlement);
    c.seleccionarNodo('entidad');
    service.consultarDocumentos.and.callFake(ref => of(documentos(ref ?? '')));
    service.consultarLiquidacionNodo.and.returnValue(of(liquidacion));
    c.seleccionarNodo('sucursal'); c.seleccionarNodo('entidad');
    oldDocs.next(documentos('respuesta anterior'));
    oldSettlement.next({ success: true, dispersionAccount: null, hasPlatformAccess: true });
    oldDocs.complete(); oldSettlement.complete();
    expect(c.documentosVisibles[0].nombre).toBe('entidad');
    expect(c.liquidacionExistente).toBeTrue(); expect(c.cargandoCuenta).toBeFalse();
  });
  it('reintenta únicamente liquidación y conserva los documentos y el nodo', () => {
    service.consultarLiquidacionNodo.and.returnValue(throwError(() => ({ status: 502 })));
    c.seleccionarNodo('entidad');
    expect(c.errorLiquidacion).toContain('Reintenta');
    expect(c.documentosVisibles[0].nombre).toBe('entidad');
    service.consultarLiquidacionNodo.and.returnValue(of(liquidacion));
    c.reintentarLiquidacion();
    expect(c.nodoSeleccionado).toBe('entidad'); expect(c.errorLiquidacion).toBe('');
    expect(c.liquidacionExistente).toBeTrue();
    expect(service.consultarDocumentos).toHaveBeenCalledTimes(1);
    expect(service.consultarLiquidacionNodo).toHaveBeenCalledTimes(2);
  });
  it('beneficiario PM/PF usa la cuenta seleccionada y conserva su catálogo', () => {
    service.consultarCuenta.and.callFake(ref => of({ success: true, entityInfo: ref === 'entidad'
      ? { typePerson: 'PM', businessName: 'Empresa', rfc: 'EMP010101XXX', businessActivityCode: 5411, bussinesLineDescription: 'Abarrotes' }
      : { typePerson: 'PF', name: 'Ana', paternalSurname: 'Pérez', maternalSurname: 'López', rfc: 'PELA900101XXX', idActivity: 12, activityDescription: 'Comercio' } }));
    c.seleccionarNodo('entidad');
    c.liquidacionForm.controls.beneficiarioIgualComercio.setValue(true);
    // This subscription normally comes from ngOnInit; use the same form-driven
    // refresh by reloading the selected account with the checkbox already active.
    c.reintentarLiquidacion();
    expect(c.liquidacionForm.controls.tipoPersonaBeneficiario.value).toBe('moral');
    expect(c.liquidacionForm.controls.nombreBeneficiario.value).toBe('Empresa');
    expect(c.liquidacionForm.controls.rfcBeneficiario.value).toBe('EMP010101XXX');
    expect(c.liquidacionForm.controls.giro.value).toBe(5411);
    c.seleccionarNodo('sucursal');
    c.liquidacionForm.controls.beneficiarioIgualComercio.setValue(true); c.reintentarLiquidacion();
    expect(c.liquidacionForm.controls.tipoPersonaBeneficiario.value).toBe('fisica');
    expect(c.liquidacionForm.controls.nombreBeneficiario.value).toBe('Ana');
    expect(c.liquidacionForm.controls.apellidoPaternoBeneficiario.value).toBe('Pérez');
    expect(c.liquidacionForm.controls.apellidoMaternoBeneficiario.value).toBe('López');
    expect(c.liquidacionForm.controls.idActivity.value).toBe(12);
    c.seleccionarNodo('entidad');
    expect(c.liquidacionForm.controls.nombreBeneficiario.value).toBe('Empresa');
    expect(c.liquidacionForm.controls.apellidoPaternoBeneficiario.value).toBe('');
  });
  it('ignora cuentas tardías tras cambiar y regresar de nodo', () => {
    const old = new Subject<unknown>(); service.consultarCuenta.and.returnValue(old);
    c.seleccionarNodo('entidad');
    service.consultarCuenta.and.callFake(ref => of({ success: true, entityInfo: { typePerson: 'PM', businessName: ref } }));
    c.seleccionarNodo('sucursal'); c.seleccionarNodo('entidad');
    old.next({ success: true, entityInfo: { businessName: 'Cuenta anterior' } }); old.complete();
    expect(c.datosForm.controls.razonSocial.value).toBe('entidad');
  });
  it('no consulta nodos ajenos ni continúa con autorización vencida', () => {
    c.seleccionarNodo('ajeno'); expect(service.consultarDocumentos).not.toHaveBeenCalled();
    c.tokenSmsValidado = false; c.seleccionarNodo('entidad'); c.reintentarLiquidacion();
    expect(service.consultarLiquidacionNodo).not.toHaveBeenCalled();
  });
});

describe('Tabla de documentos compartida en seguimiento', () => {
  it('muestra nombre y estado sin validación, observaciones ni visualización no autorizada', () => {
    const fixture = TestBed.createComponent(StepDocumentosComponent);
    fixture.componentRef.setInput('soloConsulta', true);
    fixture.componentRef.setInput('soloTablaDocumentos', true);
    fixture.componentRef.setInput('mostrarAccionesAdministrativas', false);
    fixture.componentRef.setInput('estadoConsultaDocumentos', 'ready');
    fixture.componentRef.setInput('documentos', [{ numero: 1, nombre: 'Acta constitutiva', obligatorio: false,
      estado: 'Aprobado', estatusRevision: 'APPROVED' }]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.mesa-row')?.textContent).toContain('Acta constitutiva');
    expect(element.querySelector('.mesa-row')?.textContent).toContain('Aprobado');
    expect(element.querySelector('.mesa-switch')).toBeNull();
    expect(element.querySelector('.mesa-observations')).toBeNull();
    expect(element.querySelector('.mesa-siprelad-result')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.mesa-view')?.disabled).toBeTrue();
  });
  it('conserva controles de validación para registro', () => {
    const fixture = TestBed.createComponent(StepDocumentosComponent);
    fixture.componentRef.setInput('mostrarMesaDigital', true);
    fixture.componentRef.setInput('documentos', [{ numero: 1, nombre: 'Acta', obligatorio: true }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa-switch')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.mesa-observations')).not.toBeNull();
  });
});
