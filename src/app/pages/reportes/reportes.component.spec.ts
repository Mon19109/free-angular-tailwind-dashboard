import { of, Subject, throwError } from 'rxjs';
import { ReportesComponent } from './reportes.component';
import { ReporteArchivo, ReportesService } from '../../services/reportes.service';

describe('ReportesComponent', () => {
  let component: ReportesComponent;
  let service: jasmine.SpyObj<ReportesService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<ReportesService>('ReportesService', [
      'buscarFolderReportes', 'obtenerSaldo', 'buscarArchivosReporte', 'obtenerEntidades', 'obtenerCuentas'
    ]);
    component = new ReportesComponent(service);
    component.cuentas = [{ id: '123', texto: 'Cuenta Adquirente', guidComerce: 'GUID-123' }];
    component.cuentaSeleccionada = '123';
    component.periodoSeleccionado = '2026 Agosto';
  });

  afterEach(() => component.ngOnDestroy());

  it('requires both filters before querying', () => {
    component.cuentaSeleccionada = '';
    component.consultar();
    expect(service.buscarFolderReportes).not.toHaveBeenCalled();
    expect(component.mostrarReportes).toBeFalse();
    expect(component.mensaje).toContain('Selecciona');
  });

  it('shows the five fixed reports and only supported returned folders', () => {
    service.buscarFolderReportes.and.returnValue(of([
      { name: 'EnRed' }, { name: 'Factura' }, { name: 'Comision' },
      { name: 'Conciliacion' }, { name: 'Internacionales' }, { name: 'Reserva' },
      { name: 'Compensacion' }, { name: 'Desconocido' }
    ]));
    component.consultar();
    expect(service.buscarFolderReportes).toHaveBeenCalledWith('2026 Agosto', 'ADQUIRENTE');
    expect(component.reportes.map(reporte => reporte.id)).toEqual([
      'ESTADO_PDF', 'ESTADO_EXCEL', 'CORTE_DIA', 'DIARIO_TRANSACCIONES',
      'TRANSACCIONES_SPLIT', 'EnRed', 'Factura', 'Comision', 'Conciliacion',
      'Internacionales', 'Reserva'
    ]);
    expect(component.mostrarReportes).toBeTrue();
    expect(component.cargando).toBeFalse();
  });

  it('clears previous reports when the next query returns no rows', () => {
    service.buscarFolderReportes.and.returnValue(of([{ name: 'EnRed' }]));
    component.consultar();
    service.buscarFolderReportes.and.returnValue(of([]));
    component.consultar();
    expect(component.reportes).toEqual([]);
    expect(component.mostrarReportes).toBeFalse();
    expect(component.mensaje).toContain('No hay reportes');
  });

  it('does not offer downloads after a failed query and allows retrying', () => {
    service.buscarFolderReportes.and.returnValue(throwError(() => new Error('Network')));
    component.consultar();
    expect(component.reportes).toEqual([]);
    expect(component.mostrarReportes).toBeFalse();
    expect(component.cargando).toBeFalse();
    expect(component.mensaje).toContain('No fue posible');
    service.buscarFolderReportes.and.returnValue(of([{ name: 'EnRed' }]));
    component.consultar();
    expect(component.mostrarReportes).toBeTrue();
  });

  it('ignores a pending query when the period changes', () => {
    const pending = new Subject<ReporteArchivo[]>();
    service.buscarFolderReportes.and.returnValue(pending);
    component.consultar();
    component.periodoSeleccionado = '2026 Julio';
    component.onPeriodoChange();
    pending.next([{ name: 'EnRed' }]);
    expect(component.reportes).toEqual([]);
    expect(component.mostrarReportes).toBeFalse();
    expect(component.cargando).toBeFalse();
  });

  it('keeps the CLABE of the latest selected account', () => {
    const pending = new Subject<unknown>();
    service.obtenerSaldo.and.returnValue(pending);
    component.onCuentaChange();
    component.cuentaSeleccionada = '456';
    service.obtenerSaldo.and.returnValue(of({ rows: { onsignaEntity: { clabeAccount: 'new' } } }));
    component.onCuentaChange();
    pending.next({ rows: { onsignaEntity: { clabeAccount: 'old' } } });
    expect(component.clabe).toBe('new');
  });

  it('loads entities for profile 8 and requests accounts for the selected entity', () => {
    localStorage.setItem('idPerfil', '8');
    service.obtenerEntidades.and.returnValue(of({ contextResponse: [
      { levelType: 3, name: 'Subafiliado', children: [
        { levelType: 4, idSirio: 'ENT-1', name: 'Entidad 1' },
        { levelType: 4, idSirio: 'ENT-2', name: 'Entidad 2' }
      ] }
    ] }));
    service.obtenerCuentas.and.returnValue(of({ rows: [{ idSirio: 'CUENTA-1', name: 'Cuenta emisión' }] }));

    component.ngOnInit();
    expect(component.mostrarEntidades).toBeTrue();
    expect(component.entidades.map(entidad => entidad.id)).toEqual(['ENT-1', 'ENT-2']);
    expect(service.obtenerCuentas).not.toHaveBeenCalled();

    component.entidadSeleccionada = 'ENT-2';
    component.onEntidadChange();
    expect(service.obtenerCuentas).toHaveBeenCalledWith('ENT-2');
    expect(component.cuentas.map(cuenta => cuenta.id)).toEqual(['CUENTA-1']);
    localStorage.removeItem('idPerfil');
  });

  it('clears the previous account when the entity changes', () => {
    component.mostrarEntidades = true;
    component.entidadSeleccionada = 'ENT-2';
    service.obtenerCuentas.and.returnValue(of([]));

    component.onEntidadChange();
    expect(component.cuentaSeleccionada).toBe('');
    expect(component.guidComerceSeleccionado).toBe('');
    expect(component.cuentas).toEqual([]);
  });
});
