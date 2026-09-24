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
            { idSirio: 'EMI', name: 'Emisión', idbusinessModel: 1 }
          ]),
          obtenerEntidades: () => of([{ bundle: 'EMI.1', bussinesName: 'Entidad' }])
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

  it('cierra el popup y muestra el error cuando falla la consulta', () => {
    component.seleccionarCuenta('EMI');
    component.seleccionarEntidad('EMI.1');
    response.error(new Error('Error de consulta'));
    expect(component.cargando()).toBeFalse();
    expect(component.errorCarga).toContain('No se pudieron cargar los saldos');
  });
});
