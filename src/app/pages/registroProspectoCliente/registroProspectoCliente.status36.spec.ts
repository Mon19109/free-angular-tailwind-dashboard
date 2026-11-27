import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Seguimiento: permisos reales de accesos en estatus 36', () => {
  let component: RegistroProspectoClienteComponent;
  let api: jasmine.SpyObj<SeguimientoProspectoService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('Seguimiento', ['consultarLiquidacionNodo', 'guardarAccesos', 'guardarLiquidacion', 'guardarDispersionEnRed']);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: ActivatedRoute, useValue: {} },
      { provide: SeguimientoProspectoService, useValue: api }] });
    component = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    component.enlaceAutorizado = true; component.nodoSeleccionado = 'root-ref';
    component.arbol = [{ id: 'root-ref', nombre: 'Fixture', nivel: 'sucursal', levelType: 5, hijos: [] }] as any;
  });
  function load(status: number, hasPlatformAccess = false, editAccess = status === 36) {
    api.consultarLiquidacionNodo.and.returnValue(of({ success: true, status, dispersionAccount: 'OTHER_BANK',
      cuentaCLConfirmada: true, hasPlatformAccess, permissions: { editLiquidation: false, editAccess } }));
    (component as any).consultarLiquidacionNodo();
  }
  it('33 bloquea apertura y envío incluso si hay valores locales que intentan habilitarlo', () => {
    load(33, false, true);
    expect(component.accesosPublicosBloqueados).toBeTrue();
    component.alternarSeccionFinal('accesos'); expect(component.pasoActivo).toBe('liquidacion');
    (component as any).finalizarAccesosPublicos();
    expect(api.guardarAccesos).not.toHaveBeenCalled();
  });
  it('al consultar de nuevo en 36 reanuda sin recapturar liquidación', () => {
    load(33); expect(component.pasoActivo).toBe('liquidacion');
    load(36); expect(component.accesosPublicosBloqueados).toBeFalse();
    expect(component.liquidacionCompleta).toBeTrue(); expect(component.pasoActivo).toBe('accesos');
    expect(api.guardarLiquidacion).not.toHaveBeenCalled(); expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
  });
  it('conserva accesos confirmados y refleja el estatus consultado del proveedor', () => {
    load(36, true); expect(component.accesosCompletos).toBeTrue();
    load(34, true, false); expect(component.estatusPublico).toBe(34); expect(component.accesosCompletos).toBeTrue();
    expect(component.accesosPublicosBloqueados).toBeTrue(); expect(api.guardarAccesos).not.toHaveBeenCalled();
  });
  it('fallo de consulta nunca concede acceso usando permisos anteriores', () => {
    load(36); api.consultarLiquidacionNodo.and.returnValue(throwError(() => ({ status: 503 })));
    (component as any).consultarLiquidacionNodo(); expect(component.accesosPublicosBloqueados).toBeTrue();
  });
});
