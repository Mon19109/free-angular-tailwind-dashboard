import { fakeAsync, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { InformacionCuentaComponent } from './informacionCuenta.component';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { SaldosService } from '../../services/saldos.service';

describe('Información de cuenta', () => {
  let component: InformacionCuentaComponent;
  let entities: Subject<any>;
  let balance: Subject<any>;
  let saldos: jasmine.SpyObj<SaldosService>;
  let operations: jasmine.SpyObj<OperacionesEmisionService>;

  beforeEach(() => {
    entities = new Subject();
    balance = new Subject();
    saldos = jasmine.createSpyObj('SaldosService', ['getSaldo']);
    saldos.getSaldo.and.returnValue(balance);
    operations = jasmine.createSpyObj('OperacionesEmisionService', [
      'obtenerConcentratorAccounts', 'obtenerEntidades', 'obtenerCuentas'
    ]);
    operations.obtenerConcentratorAccounts.and.returnValue(of([
      { idSirio: 'EMI', name: 'CUENTA EMISIÓN', idbusinessModel: 1 },
      { idSirio: 'ADQ', name: 'CUENTA ADQUIRENTE', idbusinessModel: '2' }
    ]));
    operations.obtenerEntidades.and.returnValue(entities);
    TestBed.configureTestingModule({ imports: [InformacionCuentaComponent], providers: [
      { provide: OperacionesEmisionService, useValue: operations },
      { provide: SaldosService, useValue: saldos }
    ] });
    component = TestBed.createComponent(InformacionCuentaComponent).componentInstance;
  });

  it('selecciona adquirente y consulta sus entidades sin mezclar emisión', fakeAsync(() => {
    component.ngOnInit();
    expect(component.cuentaSeleccionada).toBe('ADQ');
    expect(operations.obtenerEntidades).toHaveBeenCalledWith('ADQ');
    expect(operations.obtenerCuentas).not.toHaveBeenCalled();
    expect(component.cargando()).toBeTrue();
    entities.next([{ bundle: 'ADQ.1', bussinesName: 'Comercio' }]);
    entities.complete();
    expect(component.entidadesOptions[0].value).toBe('ADQ.1');
    expect(component.cargando()).toBeTrue();
    balance.complete();
    expect(component.cargando()).toBeFalse();
  }));

  it('muestra carga al consultar información y la cierra ante errores', fakeAsync(() => {
    component.seleccionarEntidad('ADQ.1');
    expect(component.cargando()).toBeTrue();
    balance.error(new Error('Sin conexión'));
    expect(component.cargando()).toBeFalse();
    expect(component.errorCarga).toContain('No se pudo cargar');
  }));

  it('ignora entidades pendientes de una cuenta anterior', fakeAsync(() => {
    component.ngOnInit();
    const nuevasEntidades = new Subject<any>();
    operations.obtenerEntidades.and.returnValue(nuevasEntidades);
    component.seleccionarCuenta('EMI');
    nuevasEntidades.next([{ bundle: 'EMI.1' }]);
    nuevasEntidades.complete();
    entities.next([{ bundle: 'ADQ.1' }]);
    expect(component.entidadesOptions[0].value).toBe('EMI.1');
    expect(component.cargando()).toBeFalse();
  }));
  it('consulta automáticamente el balance de adquirente aunque no tenga entidades', () => {
    component.ngOnInit();
    expect(saldos.getSaldo).toHaveBeenCalledOnceWith('ADQ');
    entities.next([]);
    entities.complete();
    expect(component.cargando()).toBeTrue();
    balance.next({ onsignaEntity: {
      virtualAccount: '123456789012345678', clabeAccount: '999999999999999999', balance: 975,
      name: 'Comercio adquirente', affiliationId: '123'
    } });
    balance.complete();
    expect(component.entidades).toEqual([]);
    expect(component.infoCuenta.saldo).toBe(975);
    expect(component.infoCuenta.clabe).toBe('123456789012345678');
    expect(component.infoCuenta.titular).toBe('Comercio adquirente');
    expect(component.cargando()).toBeFalse();
  });

  it('vuelve a consultar adquirente al cambiar de cuenta y descarta balances anteriores', () => {
    component.ngOnInit();
    component.seleccionarCuenta('EMI');
    balance.next({ balance: 999 });
    expect(component.infoCuenta.saldo).toBe(0);
    expect(saldos.getSaldo).toHaveBeenCalledTimes(1);
    component.seleccionarCuenta('ADQ');
    expect(saldos.getSaldo).toHaveBeenCalledTimes(2);
    expect(saldos.getSaldo).toHaveBeenCalledWith('ADQ');
  });

});
