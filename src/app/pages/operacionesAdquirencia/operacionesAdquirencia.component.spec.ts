import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { OperacionesAdquirenciaComponent } from './operacionesAdquirencia.component';
import { OperacionesAdquirenciaService } from '../../services/operacionesadquirencia.service';

describe('Niveles de Operaciones adquirencia', () => {
  let component: OperacionesAdquirenciaComponent;
  let service: jasmine.SpyObj<OperacionesAdquirenciaService>;
  let stored: Array<[string, string | null]>;
  beforeEach(() => {
    stored = ['nodeID', 'idRol', 'auth_session'].map(key => [key, localStorage.getItem(key)]);
    localStorage.removeItem('auth_session');
    localStorage.setItem('nodeID', '83');
    localStorage.setItem('idRol', '3');
    service = jasmine.createSpyObj('OperacionesAdquirenciaService', [
      'getSubafiliadoById', 'getSubafiliados', 'getEntidades', 'getSucursales', 'getCajas',
      'obtenerTiposOperacion', 'obtenerStatus', 'enviarFormulario'
    ]);
    service.getSubafiliadoById.and.returnValue(of([{ idNode: 83, name: 'Subafiliado' }]));
    service.getEntidades.and.returnValue(of([{ idNode: 84 }]));
    service.getSucursales.and.returnValue(of([{ idNode: 85 }]));
    service.getCajas.and.returnValue(of([{ idNode: 86 }]));
    service.obtenerTiposOperacion.and.returnValue(of({ catOperationTypes: [] }));
    service.obtenerStatus.and.returnValue(of([]));
    service.enviarFormulario.and.returnValue(of({ operations: [{ id: 1 }], totalItems: 21 }));
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
  for (const [campo, id, cuenta] of [
    ['cuenta', '83', 'SUB-83'], ['entidad', '84', 'ENT-84'],
    ['sucursal', '85', 'SUC-85'], ['caja', '86', 'CAJA-86']
  ]) {
    it(`envía la cuenta asociada a ${campo} y conserva filtros al paginar`, () => {
      component.cuentas = [{ idNode: 83, account: 'SUB-83' }];
      component.entidades = [{ idNode: 84, account: 'ENT-84' }];
      component.sucursales = [{ idNode: 85, account: 'SUC-85' }];
      component.cajas = [{ idNode: 86, account: 'CAJA-86' }];
      component.formulario.patchValue({ cuenta: '83', entidad: '', sucursal: '', caja: '',
        fechaInicio: '2023-09-01 00:00', fechaFin: '2023-09-30 23:59', [campo]: id
      }, { emitEvent: false });
      component.onSubmit();
      expect(service.enviarFormulario.calls.mostRecent().args[0].cuentaConsulta).toBe(cuenta);
      expect(service.enviarFormulario.calls.mostRecent().args[1]).toBe(0);
      component.formulario.patchValue({ fechaInicio: '2024-01-01 00:00' }, { emitEvent: false });
      component.cambiarPagina(2);
      expect(service.enviarFormulario.calls.mostRecent().args[0].fechaInicio).toBe('2023-09-01 00:00');
      expect(service.enviarFormulario.calls.mostRecent().args[1]).toBe(1);
      expect(component.paginaActual).toBe(2);
      expect(component.totalRegistros).toBe(21);
    });
  }

  it('un administrador con un solo subafiliado carga todos sus niveles desde ese nodo', () => {
    component.rolId = '2';
    service.getSubafiliados.and.returnValue(of({ contextResponse: [
      { idNode: 90, levelType: 3, name: 'Subafiliado', account: 'SUB90' } as any
    ] }));
    service.getSubafiliadoById.and.returnValue(of([
      { idNode: 90, levelType: 3, name: 'Subafiliado', account: 'SUB90' }
    ]));
    component.cargarSubafiliados();
    expect(component.formulario.getRawValue().cuenta).toBe('90');
    expect(service.getEntidades.calls.mostRecent().args).toEqual(['90']);
    expect(service.getSucursales.calls.mostRecent().args).toEqual(['90']);
    expect(service.getCajas.calls.mostRecent().args).toEqual(['90']);
  });

  it('extrae entidades del árbol sin mostrar el subafiliado como entidad', () => {
    service.getEntidades.and.returnValue(of({ idNode: 90, levelType: 3, children: [
      { idNode: 91, levelType: 4, name: 'Entidad', account: 'ENT91' },
      { idNode: 92, levelType: 5, name: 'Sucursal' }
    ] }));
    component.formulario.get('cuenta')?.enable({ emitEvent: false });
    component.formulario.patchValue({ cuenta: '90' });
    expect(component.entidades.map(item => item.idNode)).toEqual([91]);
  });

});
