import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { OperacionesAdquirenciaComponent } from './operacionesAdquirencia.component';
import { OperacionesAdquirenciaService } from '../../services/operacionesadquirencia.service';

describe('Niveles de Operaciones adquirencia', () => {
  let component: OperacionesAdquirenciaComponent;
  let service: jasmine.SpyObj<OperacionesAdquirenciaService>;
  let stored: Array<[string, string | null]>;
  beforeEach(() => {
    stored = ['nodeID', 'idRol'].map(key => [key, localStorage.getItem(key)]);
    localStorage.setItem('nodeID', '83');
    localStorage.setItem('idRol', '3');
    service = jasmine.createSpyObj('OperacionesAdquirenciaService', [
      'getSubafiliadoById', 'getSubafiliados', 'getEntidades', 'getSucursales', 'getCajas',
      'obtenerTiposOperacion', 'obtenerStatus'
    ]);
    service.getSubafiliadoById.and.returnValue(of([{ idNode: 83, name: 'Subafiliado' }]));
    service.getEntidades.and.returnValue(of([{ idNode: 84 }]));
    service.getSucursales.and.returnValue(of([{ idNode: 85 }]));
    service.getCajas.and.returnValue(of([{ idNode: 86 }]));
    service.obtenerTiposOperacion.and.returnValue(of({ catOperationTypes: [] }));
    service.obtenerStatus.and.returnValue(of([]));
    TestBed.configureTestingModule({ imports: [OperacionesAdquirenciaComponent], providers: [
      { provide: OperacionesAdquirenciaService, useValue: service }
    ] });
    component = TestBed.createComponent(OperacionesAdquirenciaComponent).componentInstance;
    component.ngOnInit();
  });
  afterEach(() => stored.forEach(([key, value]) => {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  }));

  it('consulta los cuatro niveles al iniciar desde el subafiliado', () => {
    expect(service.getSubafiliadoById).toHaveBeenCalledTimes(1);
    expect(service.getEntidades).toHaveBeenCalledOnceWith('83');
    expect(service.getSucursales).toHaveBeenCalledOnceWith('83');
    expect(service.getCajas).toHaveBeenCalledOnceWith('83');
    expect(component.sucursales.length).toBe(1);
    expect(component.cajas.length).toBe(1);
  });

  it('limita descendientes al padre seleccionado y restaura el subafiliado al limpiar', () => {
    component.formulario.patchValue({ entidad: '84' });
    expect(service.getSucursales).toHaveBeenCalledWith('84');
    expect(service.getCajas).toHaveBeenCalledWith('84');
    component.formulario.patchValue({ sucursal: '85' });
    expect(service.getCajas).toHaveBeenCalledWith('85');
    component.formulario.patchValue({ entidad: '' });
    expect(service.getSucursales.calls.mostRecent().args).toEqual(['83']);
    expect(service.getCajas.calls.mostRecent().args).toEqual(['83']);
  });

  it('descarta respuestas anteriores al cambiar de entidad', () => {
    const anterior = new Subject<any>();
    service.getSucursales.and.returnValue(anterior);
    component.formulario.patchValue({ entidad: '84' });
    service.getSucursales.and.returnValue(of([{ idNode: 99 }]));
    component.formulario.patchValue({ entidad: '88' });
    anterior.next([{ idNode: 85 }]);
    expect(component.sucursales).toEqual([{ idNode: 99 }]);
  });
});
