import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { DetalleOperacionComponent } from './detalle-operacion.component';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';

describe('Detalle de liquidación', () => {
  let respuesta: Subject<any>;
  let service: jasmine.SpyObj<OperacionesEmisionService>;
  function crear(validate = '12345') {
    respuesta = new Subject();
    service = jasmine.createSpyObj('OperacionesEmisionService', ['obtenerDetalleOperacion']);
    service.obtenerDetalleOperacion.and.returnValue(respuesta);
    TestBed.configureTestingModule({ imports: [DetalleOperacionComponent], providers: [
      { provide: OperacionesEmisionService, useValue: service },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ validate })) } }
    ] });
    return TestBed.createComponent(DetalleOperacionComponent).componentInstance;
  }
  it('usa la referencia, normaliza la respuesta PHP y termina la carga', () => {
    const component = crear();
    expect(service.obtenerDetalleOperacion).toHaveBeenCalledOnceWith('12345');
    expect(component.cargando()).toBeTrue();
    respuesta.next({ rows: { content: [{ amount: 2.5, authorizationNumber: '001' }] } });
    respuesta.complete();
    expect(component.cargando()).toBeFalse();
    expect(component.valor(component.operaciones()[0], 'amount')).toBe('$2.50');
    expect(component.valor(component.operaciones()[0], 'authorizationNumber')).toBe('001');
  });
  it('maneja errores y omite consultas sin referencia', () => {
    const component = crear('');
    expect(service.obtenerDetalleOperacion).not.toHaveBeenCalled();
    expect(component.error()).toContain('Falta');
    component.liquidationID = '12345';
    component.cargar();
    respuesta.error(new Error('Error de red'));
    expect(component.cargando()).toBeFalse();
    expect(component.error()).toContain('No fue posible');
  });
  it('solo ofrece ticket a operaciones aprobadas con referencia y autorización', () => {
    const component = crear('');
    expect(component.ticketUrl({ status: 'Denegada' })).toBeNull();
    expect(component.ticketUrl({ status: 'Aprobada' })).toBeNull();
    expect(component.ticketUrl({ status: 'Aprobada', authorizationRrcext: 'ABC', authorizationNumber: '001' })).toContain('ABC001.pdf');
  });
});
