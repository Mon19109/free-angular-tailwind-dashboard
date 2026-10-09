import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TransaccionesAdquirenciaComponent } from './transaccionesAdquirencia.component';
import { TransaccionesAdquirenciaService } from '../../services/transaccionesadquirencia.service';

describe('Filtros de Transacciones Adquirencia', () => {
  let component: TransaccionesAdquirenciaComponent;
  let service: jasmine.SpyObj<TransaccionesAdquirenciaService>;

  beforeEach(() => {
    service = jasmine.createSpyObj('TransaccionesAdquirenciaService', ['getSubafiliados', 'getEntidades', 'getSucursales', 'getCajas']);
    for (const method of [service.getEntidades, service.getSucursales, service.getCajas]) method.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [{ provide: TransaccionesAdquirenciaService, useValue: service }] });
    component = TestBed.runInInjectionContext(() => new TransaccionesAdquirenciaComponent());
    component.rolId = '2';
  });

  it('descarta niveles distintos y nodos sin levelType explícito', () => {
    const tree = { idNode: 'sub', levelType: 3, children: [
      { idNode: 'entidad', levelType: 4, children: [
        { idNode: 'sucursal', levelType: 5, children: [{ idNode: 'caja', levelType: 6 }] },
      ] }, { idNode: 'desconocido' }, { idNode: 'otro', levelType: 7 },
    ] };
    service.getEntidades.and.returnValue(of(tree));
    service.getSucursales.and.returnValue(of(tree));
    service.getCajas.and.returnValue(of(tree));
    component.filtros.subafiliado = 'sub';
    component.onSubafiliadoChange();
    expect(component.entidades().map(item => item.idNode)).toEqual(['entidad']);
    expect(component.sucursales().map(item => item.idNode)).toEqual(['sucursal']);
    expect(component.cajas().map(item => item.idNode)).toEqual(['caja']);
  });

  it('consulta sucursales y cajas de la entidad y después solo cajas de la sucursal', () => {
    component.filtros = { subafiliado: 'sub', entidad: 'entidad', sucursal: 'anterior', caja: 'anterior' };
    component.onEntidadChange();
    expect(component.filtros.sucursal).toBe('');
    expect(component.filtros.caja).toBe('');
    expect(service.getSucursales).toHaveBeenCalledOnceWith('entidad');
    expect(service.getCajas).toHaveBeenCalledOnceWith('entidad');
    component.filtros.sucursal = 'sucursal';
    component.onSucursalChange();
    expect(service.getCajas.calls.mostRecent().args).toEqual(['sucursal']);
    component.filtros.sucursal = '';
    component.onSucursalChange();
    expect(service.getCajas.calls.mostRecent().args).toEqual(['entidad']);
  });

  it('ignora respuestas atrasadas de la entidad anterior', () => {
    const anterior = new Subject<any>();
    service.getCajas.and.returnValue(anterior);
    component.filtros.entidad = 'entidad-anterior';
    component.onEntidadChange();
    service.getCajas.and.returnValue(of([{ idNode: 'caja-nueva', levelType: 6 }]));
    component.filtros.entidad = 'entidad-nueva';
    component.onEntidadChange();
    anterior.next([{ idNode: 'caja-anterior', levelType: 6 }]);
    expect(component.cajas().map(item => item.idNode)).toEqual(['caja-nueva']);
  });
});
