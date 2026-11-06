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
    service = jasmine.createSpyObj<SeguimientoProspectoService>('Seguimiento', ['consultarDocumentos', 'consultarLiquidacionNodo']);
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
