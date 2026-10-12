import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { BeneficiariosService } from '../../services/beneficiarios.service';
import { BeneficiariosComponent } from './beneficiarios.component';

describe('Confirmación de eliminación de beneficiarios', () => {
  let component: BeneficiariosComponent;
  let service: jasmine.SpyObj<BeneficiariosService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<BeneficiariosService>('BeneficiariosService', ['eliminarContactos']);
    service.eliminarContactos.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      providers: [{ provide: BeneficiariosService, useValue: service }]
    });
    component = TestBed.runInInjectionContext(() => new BeneficiariosComponent());
    spyOn(component, 'cargarContactos');
  });

  it('abre el popup sin llamar al servicio y permite cancelar conservando la selección', () => {
    component.idsEliminar.add('1');
    component.eliminarSeleccionados();
    expect(component.mostrarModalConfirmacionEliminacion).toBeTrue();
    expect(service.eliminarContactos).not.toHaveBeenCalled();

    component.cancelarEliminacion();
    component.confirmarEliminacion();
    expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
    expect(component.idsEliminar.has('1')).toBeTrue();
    expect(service.eliminarContactos).not.toHaveBeenCalled();
  });

  for (const ids of [['1'], ['1', '2']]) {
    it(`elimina ${ids.length} beneficiarios únicamente tras confirmar y evita solicitudes duplicadas`, () => {
      const response = new Subject<any>();
      service.eliminarContactos.and.returnValue(response);
      component.idsEliminar = new Set(ids);
      component.eliminarSeleccionados();
      component.idsEliminar.add('otro');

      component.confirmarEliminacion();
      component.confirmarEliminacion();
      expect(service.eliminarContactos).toHaveBeenCalledOnceWith(ids);
      expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
      expect(component.cargando).toBeTrue();

      response.next({ success: true });
      response.complete();
      expect(component.cargarContactos).toHaveBeenCalledTimes(1);
      expect(component.idsEliminar.size).toBe(0);
      expect(component.tipoResultadoEliminacion).toBe('exito');
    });
  }

  it('avisa si no hay selección sin permitir eliminar', () => {
    component.eliminarSeleccionados();
    component.confirmarEliminacion();
    expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
    expect(component.tipoResultadoEliminacion).toBe('error');
    expect(component.mensajeResultadoEliminacion).toContain('Selecciona al menos');
    expect(service.eliminarContactos).not.toHaveBeenCalled();
  });

  it('mantiene la selección y muestra el error si el servicio rechaza la eliminación', () => {
    service.eliminarContactos.and.returnValue(of({ success: false, message: 'Eliminación rechazada' }));
    component.idsEliminar.add('1');
    component.eliminarSeleccionados();
    component.confirmarEliminacion();
    expect(component.idsEliminar.has('1')).toBeTrue();
    expect(component.cargarContactos).not.toHaveBeenCalled();
    expect(component.cargando).toBeFalse();
    expect(component.tipoResultadoEliminacion).toBe('error');
    expect(component.mensajeResultadoEliminacion).toBe('Eliminación rechazada');
  });
});
