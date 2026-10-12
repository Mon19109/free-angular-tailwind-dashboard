import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SaldosComponent } from './saldos.component';
import { SaldosService } from '../../services/saldos.service';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';

describe('Selección de entidad en Saldos', () => {
  let component: SaldosComponent;
  let response: Subject<any>;
  let saldos: jasmine.SpyObj<SaldosService>;

  beforeEach(() => {
    response = new Subject();
    saldos = jasmine.createSpyObj('SaldosService', ['getDetalleSaldo']);
    saldos.getDetalleSaldo.and.returnValue(response);
    TestBed.configureTestingModule({
      imports: [SaldosComponent],
      providers: [
        { provide: SaldosService, useValue: saldos },
        { provide: OperacionesEmisionService, useValue: {
          obtenerConcentratorAccounts: () => of([
            { idSirio: 'ADQ', name: 'Adquirente', idbusinessModel: '2' },
            { idSirio: 'EMI', name: 'Emisión', idbusinessModel: 1 },
            { idSirio: 'RES', name: ' Cuenta Reserva ', idbusinessModel: 1 }
          ]),
          obtenerEntidades: () => of([
            { bundle: 'EMI.1', bussinesName: 'Entidad', type: 4, active: true },
            { bundle: 'EMI.2', bussinesName: 'Inactiva', type: 4, active: false },
            { bundle: 'EMI.3', bussinesName: 'Sucursal', type: 5, active: true },
            { bundle: 'EMI.4', bussinesName: 'Sin estado', type: 4 },
            { bundle: 'EMI.5', bussinesName: 'Estado en texto', type: 4, active: 'true' }
          ])
        } }
      ]
    });
    component = TestBed.createComponent(SaldosComponent).componentInstance;
    component.ngOnInit();
  });

  it('carga adquirente automáticamente pero emisión espera una selección nueva', () => {
    expect(saldos.getDetalleSaldo).toHaveBeenCalledOnceWith('ADQ');
    component.seleccionarCuenta('EMI');
    expect(component.entidadSeleccionada).toBe('');
    expect(component.saldos).toEqual([]);
    expect(saldos.getDetalleSaldo).toHaveBeenCalledTimes(1);
    expect(component.cargando()).toBeFalse();

    component.seleccionarEntidad('EMI.1');
    expect(saldos.getDetalleSaldo).toHaveBeenCalledWith('EMI.1');
    expect(component.cargando()).toBeTrue();
    component.seleccionarCuenta('ADQ');
    component.seleccionarCuenta('EMI');
    expect(component.entidadSeleccionada).toBe('');
    expect(saldos.getDetalleSaldo).toHaveBeenCalledTimes(3);
    response.next({ entities: [{ id: 'anterior' }] });
    expect(component.saldos).toEqual([]);
  });

  it('oculta Cuenta Reserva del listado de cuentas', () => {
    expect(component.cuentasOptions.map(cuenta => cuenta.value)).toEqual(['ADQ', 'EMI']);
  });

  it('muestra únicamente entidades de tipo 4 activas', () => {
    component.seleccionarCuenta('EMI');
    expect(component.entidadesOptions).toEqual([{ label: 'EMI.1 - Entidad', value: 'EMI.1' }]);
  });

  it('pagina los resultados y conserva todas las filas para exportación', () => {
    response.next({ entities: Array.from({ length: 23 }, (_, id) => ({ id })) });
    expect(component.saldosPaginados.length).toBe(10);
    expect(component.totalPaginas).toBe(3);
    component.cambiarPagina(3);
    expect(component.saldosPaginados.map(saldo => saldo.id)).toEqual([20, 21, 22]);
    expect((component as any).filasExportacion().length).toBe(23);
    component.cambiarPagina(99);
    expect(component.paginaActual).toBe(3);
    component.cambiarPagina(0);
    expect(component.paginaActual).toBe(1);
  });

  it('reinicia la página al cambiar de cuenta o entidad y maneja resultados vacíos', () => {
    component.paginaActual = 3;
    component.seleccionarCuenta('EMI');
    expect(component.paginaActual).toBe(1);
    component.paginaActual = 2;
    component.seleccionarEntidad('EMI.1');
    response.next({ entities: [] });
    expect(component.paginaActual).toBe(1);
    expect(component.totalPaginas).toBe(1);
    expect(component.saldosPaginados).toEqual([]);
  });

  it('abrevia una lista larga de páginas manteniendo los extremos y la página actual', () => {
    response.next({ entities: Array.from({ length: 200 }, (_, id) => ({ id })) });
    component.cambiarPagina(10);
    expect(component.paginasVisibles.map(pagina => pagina.valor)).toEqual([1, '...', 9, 10, 11, '...', 20]);
  });

  it('cierra el popup y muestra el error cuando falla la consulta', () => {
    component.seleccionarCuenta('EMI');
    component.seleccionarEntidad('EMI.1');
    response.error(new Error('Error de consulta'));
    expect(component.cargando()).toBeFalse();
    expect(component.errorCarga).toContain('No se pudieron cargar los saldos');
  });
});
