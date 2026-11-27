import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { of, Subject, throwError } from 'rxjs';
import { TransaccionesAdquirenciaComponent } from './transaccionesAdquirencia.component';
import { TransaccionesAdquirenciaService } from '../../services/transaccionesadquirencia.service';

describe('Filtros de Transacciones Adquirencia', () => {
  let component: TransaccionesAdquirenciaComponent;
  let service: jasmine.SpyObj<TransaccionesAdquirenciaService>;

  beforeEach(() => {
    service = jasmine.createSpyObj('TransaccionesAdquirenciaService', [
      'getSubafiliados', 'getSubafiliadoById', 'getEntidades', 'getSucursales', 'getCajas',
      'getOperaciones', 'getEstadosTransaccion', 'buscarTransacciones'
    ]);
    service.getSubafiliados.and.returnValue(of([]));
    service.getSubafiliadoById.and.returnValue(of([]));
    service.getOperaciones.and.returnValue(of({ catTransactionTypes: [] }));
    service.getEstadosTransaccion.and.returnValue(of({ catResponseCodes: [] }));
    service.buscarTransacciones.and.returnValue(of([]));
    for (const method of [service.getEntidades, service.getSucursales, service.getCajas]) method.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [{ provide: TransaccionesAdquirenciaService, useValue: service },
      { provide: AuthService, useValue: { getSessionValue: () => null } }] });
    component = TestBed.runInInjectionContext(() => new TransaccionesAdquirenciaComponent());
    component.rolId = '2';
  });

  it('consulta los cinco servicios al iniciar y conserva el subafiliado de la sesion', () => {
    spyOn(TestBed.inject(AuthService), 'getSessionValue').and.callFake(key =>
      ({ idRol: '3', idContext: '83', nodeID: 'sub-sesion' } as Record<string, string>)[key] ?? null
    );
    service.getSubafiliados.and.returnValue(of([{ idNode: 'otro', levelType: 3 }]));
    service.getSubafiliadoById.and.returnValue(of([{ idNode: 'sub-sesion', levelType: 3 }]));

    component.ngOnInit();

    expect(service.getSubafiliados).toHaveBeenCalledTimes(1);
    expect(service.getSubafiliadoById).toHaveBeenCalledTimes(1);
    expect(service.getEntidades).toHaveBeenCalledOnceWith('sub-sesion');
    expect(service.getSucursales).toHaveBeenCalledOnceWith('sub-sesion');
    expect(service.getCajas).toHaveBeenCalledOnceWith('sub-sesion');
    expect(component.filtros.subafiliado).toBe('sub-sesion');
    expect(service.buscarTransacciones).toHaveBeenCalledTimes(1);
  });

  it('conserva el catalogo general aunque falle la consulta del subafiliado de sesion', () => {
    service.getSubafiliados.and.returnValue(of([{ idNode: 'sub', levelType: 3 }]));
    service.getSubafiliadoById.and.returnValue(throwError(() => new Error('Sin subafiliado')));

    component.cargarSubafiliados();

    expect(component.subafiliados().map(item => item.idNode)).toEqual(['sub']);
  });

  for (const [inicio, fin] of [
    ['2025-01-01 00:00', '2025-02-01 00:00'],
    ['2025-04-01 00:00', '2025-05-01 00:00'],
    ['2025-02-01 00:00', '2025-03-01 00:00'],
    ['2024-02-01 00:00', '2024-03-01 00:00'],
    ['2025-01-31 12:00', '2025-02-28 12:00'],
    ['2024-01-31 12:00', '2024-02-29 12:00'],
    ['2025-12-15 12:00', '2026-01-15 12:00']
  ]) {
    it(`permite un mes calendario desde ${inicio} hasta ${fin} y rechaza un minuto adicional`, () => {
      component.filtros.fechaInicio = inicio;
      component.filtros.fechaFin = fin;
      expect(component.validarFechas()).toBeTrue();
      const exceso = new Date(fin.replace(' ', 'T'));
      exceso.setMinutes(exceso.getMinutes() + 1);
      component.filtros.fechaFin = (component as any).formatearFechaFiltro(exceso);
      expect(component.validarFechas()).toBeFalse();
      expect(component.errorMessage()).toContain('un mes calendario');
    });
  }

  it('permite consultar enero completo incluyendo la última hora del día 31', () => {
    component.filtros.fechaInicio = '2025-01-01 00:00';
    component.filtros.fechaFin = '2025-01-31 23:59';
    expect(component.validarFechas()).toBeTrue();
  });

  it('inicializa fechas locales dentro del mes actual con un rango válido', () => {
    component.filtros.fechaInicio = '';
    component.filtros.fechaFin = '';
    component.inicializarFechas();
    expect(component.filtros.fechaInicio).toMatch(/^\d{4}-\d{2}-01T00:00$/);
    expect(component.validarFechas()).toBeTrue();
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
