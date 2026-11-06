import { of, Subject, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { ReportesComponent } from './reportes.component';
import { ReportesService, TipoDescarga } from '../../services/reportes.service';

describe('ReportesComponent BFF', () => {
  let component: ReportesComponent;
  let service: jasmine.SpyObj<ReportesService>;
  let perfil: string;
  beforeEach(() => {
    service = jasmine.createSpyObj<ReportesService>('ReportesService', ['buscar', 'buscarReporte', 'obtenerCuentas', 'descargar', 'guardarArchivo']);
    perfil = '7';
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { getSessionValue: () => perfil } }] });
    component = TestBed.runInInjectionContext(() => new ReportesComponent(service));
    component.cuentas = [{ id: 'sirio', texto: 'Cuenta Adquirente', guidComerce: 'guid' }];
    component.cuentaSeleccionada = 'sirio'; component.periodoSeleccionado = '2026 Octubre';
    service.buscar.and.returnValue(of({ rows: [] }));
  });
  afterEach(() => component.ngOnDestroy());
  it('requiere filtros y no inventa un tipo de cuenta', () => {
    component.cuentaSeleccionada = ''; component.consultar();
    expect(service.buscar).not.toHaveBeenCalled();
    component.cuentaSeleccionada = 'sirio'; component.cuentas[0].texto = 'Entidad'; component.consultar();
    expect(service.buscar).not.toHaveBeenCalled();
    expect(component.mensaje).toContain('no es compatible');
  });
  it('envía filtros del contrato y conserva los directorios conocidos', () => {
    service.buscar.and.returnValue(of({ rows: [{ name: 'EnRed' }, { name: 'Desconocido' }] }));
    component.consultar();
    expect(service.buscar).toHaveBeenCalledWith({ periodo: '2026 Octubre', tipoCuenta: 'Cuenta Adquirente', guid: 'guid', cuenta: 'sirio' });
    expect(component.reportes.map(r => r.id)).toEqual(['ESTADO_PDF', 'ESTADO_EXCEL', 'CORTE_DIA', 'DIARIO_TRANSACCIONES', 'TRANSACCIONES_SPLIT', 'EnRed']);
  });
  it('el cambio de periodo cancela resultados anteriores', () => {
    const pending = new Subject<{ rows: unknown }>(); service.buscar.and.returnValue(pending);
    component.consultar(); component.onPeriodoChange(); pending.next({ rows: [{ name: 'EnRed' }] });
    expect(component.reportes).toEqual([]); expect(component.cargando).toBeFalse();
  });
  it('no simula acceso cuando falta autorización o el BFF deniega', () => {
    for (const status of [401, 403, 503]) {
      service.buscar.and.returnValue(throwError(() => ({ status, error: { code: 'REPORTES_AUTHORIZATION_UNAVAILABLE' } })));
      component.consultar();
      expect(component.mostrarReportes).toBeFalse(); expect(component.reportes).toEqual([]);
      expect(component.mensaje).toContain('autorización');
      expect(service.descargar).not.toHaveBeenCalled();
    }
  });
  it('carga cuentas por idSirio y no inventa saldo ni CLABE', () => {
    service.obtenerCuentas.and.returnValue(of({ cuentas: [{ idSirio: 'cuenta', guidCommerce: 'guid-cuenta', name: 'Cuenta Emisión' }] }));
    component.cargarCuentas(); component.cuentaSeleccionada = 'cuenta'; component.onCuentaChange();
    expect(component.cuentas[0].id).toBe('cuenta'); expect(component.guidComerceSeleccionado).toBe('guid-cuenta');
    expect(component.clabe).toBe(''); expect(component.mensaje).toContain('pendiente de integración');
  });
  it('muestra entidades del árbol, sin enviar entitySonID a un endpoint que no lo acepta', () => {
    perfil = '8';
    service.obtenerCuentas.and.returnValue(of({ cuentas: [{ idSirio: 'entidad', guidCommerce: 'guid', name: 'Entidad', levelType: 4 }] }));
    component.ngOnInit(); component.entidadSeleccionada = 'entidad'; component.onEntidadChange();
    expect(component.entidades).toEqual([{ id: 'entidad', texto: 'Entidad' }]);
    expect(service.obtenerCuentas).toHaveBeenCalledOnceWith();
    expect(component.cuentas).toEqual([]); expect(component.mensaje).toContain('pendiente de integración');
  });
  it('descarga los cinco tipos soportados como Blob, usando la cuenta seleccionada', () => {
    const blob = new Blob(['contenido']); service.descargar.and.returnValue(of(blob)); component.consultar();
    const tipos: TipoDescarga[] = ['estado-pdf', 'estado-excel', 'transacciones', 'diario', 'split'];
    component.reportes.forEach((reporte, index) => {
      component.verReporte(reporte);
      expect(service.descargar).toHaveBeenCalledWith(tipos[index], { periodo: '2026 Octubre', cuenta: 'sirio', clabe: '' });
      expect(service.guardarArchivo).toHaveBeenCalledWith(blob, `${reporte.titulo}-2026 Octubre.${index === 0 ? 'pdf' : 'xlsx'}`);
    });
  });
  it('no abre URLs externas devueltas por directorios dinámicos', () => {
    const open = spyOn(window, 'open');
    service.buscar.and.returnValue(of({ rows: [{ name: 'EnRed' }] }));
    service.buscarReporte.and.returnValue(of({ rows: [{ url: 'https://proveedor.invalid/privado' }] }));
    component.consultar(); const reporte = component.reportes.find(r => r.id === 'EnRed');
    if (!reporte) throw new Error('Missing report');
    component.verReporte(reporte);
    expect(service.buscarReporte).toHaveBeenCalledWith({ periodo: '2026 Octubre', tipoCuenta: 'Cuenta Adquirente', guid: 'guid', cuenta: 'sirio' }, 'EnRed');
    expect(open).not.toHaveBeenCalled(); expect(service.guardarArchivo).not.toHaveBeenCalled();
    expect(component.mensaje).toContain('pendiente de integración');
  });
});
