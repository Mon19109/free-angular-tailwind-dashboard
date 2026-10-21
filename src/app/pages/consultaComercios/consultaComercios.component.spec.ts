import { AuthService } from '../../services/auth.service';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ConsultaComerciosComponent } from './consultaComercios.component';
import { ConsultaComerciosService } from '../../services/consulta-comercios.service';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';
import { Router } from '@angular/router';

const auth = { hasValidSession: () => true, getUserData: () => ({ idRol: 2 }) } as unknown as AuthService;

describe('Filtro de pendientes de revisión', () => {
  function crear(statuses: unknown[], router = {} as Router): ConsultaComerciosComponent {
    const service = { buscarComercios: () => of({ commerces: statuses.map((status, index) => ({
      status: String(status), ref: `ref-${index}`, displayId: `COM.${index}`, nameCommerce: `Comercio ${index}`, nivel: 'Entidad', jerarquia: `Entidad ${index + 1}`
    })) }) };
    return new ConsultaComerciosComponent(router,
      service as unknown as ConsultaComerciosService, {} as RecuperarCuentaService, auth);
  }

  it('acepta textos con y sin acento y el código 27 numérico o texto', () => {
    const component = crear(['PENDIENTE_REVISIÓN', 'PENDIENTE_REVISION', 27, '27', 'ACTIVO', 'INACTIVO']);
    expect(component.hayPendientesRevision).toBeTrue();
    component.paginaActual = 3;
    component.seleccionarNivel('pendientes');
    expect(component.resultados.length).toBe(4);
    expect(component.resultados.every(item => item.estatus === 'Pendiente de revisión')).toBeTrue();
    expect(component.paginaActual).toBe(1);
    component.seleccionarNivel('todos');
    expect(component.resultados.length).toBe(6);
  });

  it('desactiva pendientes al seleccionar otro nivel y viceversa', () => {
    const component = crear([27, 'ACTIVO']);
    component.seleccionarNivel('entidad');
    component.seleccionarNivel('pendientes');
    expect(component.filtros.nivel).toBe('pendientes');
    expect(component.resultados.length).toBe(1);
    component.seleccionarNivel('entidad');
    expect(component.soloPendientesRevision).toBeFalse();
    expect(component.filtros.nivel).toBe('entidad');
    expect(component.resultados.length).toBe(2);
  });

  it('no ofrece el botón si no hay pendientes y restablece el filtro al limpiar', () => {
    expect(crear(['ACTIVO', 'INACTIVO']).hayPendientesRevision).toBeFalse();
    const component = crear([27, 'ACTIVO']);
    component.seleccionarNivel('pendientes');
    component.limpiar();
    expect(component.soloPendientesRevision).toBeFalse();
    expect(component.resultados.length).toBe(2);
  });
  it('bloquea edición y contraseñas incluso si se invocan directamente con identificadores', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const service = jasmine.createSpyObj('Consulta', ['buscarComercios', 'consultarPasswordCaja']);
    service.buscarComercios.and.returnValue(of({ success: true, commerces: [] }));
    const recuperar = jasmine.createSpyObj('Recuperar', ['recuperarCuenta']);
    const component = new ConsultaComerciosComponent(router, service, recuperar, auth);
    const caja: any = { ref: 'ref-caja', guid: 'legacy-guid', nivel: 'Caja', estatus: 'Activo' };
    component.ejecutarAccion('editarInformacion', caja);
    component.ejecutarAccion('password', caja);
    component.modalPassword = caja;
    component.abrirCambioPassword();
    component.modalCambiarPassword = caja;
    component.nuevaPassword = component.confirmarPassword = 'FixtureOnly12!';
    component.guardarPassword();
    (component as any).consultarPasswordCaja(caja);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.consultarPasswordCaja).not.toHaveBeenCalled();
    expect(recuperar.recuperarCuenta).not.toHaveBeenCalled();
    expect(component.puedeEditarInformacion).toBeFalse();
    expect(component.puedeConsultarPassword(caja)).toBeFalse();
  });

  it('conserva jerarquía, búsqueda local, paginación y filas completas para ambas exportaciones', () => {
    const component = crear(Array(23).fill('ACTIVO'));
    expect(component.comerciosPaginados.length).toBe(10);
    component.cambiarPagina(3);
    expect(component.comerciosPaginados.length).toBe(3);
    const filas = (component as any).filasExportacion();
    expect(filas.length).toBe(23);
    expect(filas[0][0]).toBe('COM.0');
    expect(component.resultados[0].jerarquia).toBe('Entidad 1');
    component.filtros.entidad = '23';
    component.buscar();
    expect(component.resultados.length).toBe(1);
    expect(component.resultados[0].idComercio).toBe('COM.22');
    component.limpiar();
    component.busquedaTabla = 'Comercio 22';
    expect(component.resultadosFiltradosTabla.length).toBe(1);
    expect((component as any).filasExportacion().length).toBe(1);
  });

  it('inactivar y baja siguen siendo cambios locales sin servicios adicionales', () => {
    const component = crear(['ACTIVO']);
    const comercio = component.resultados[0];
    component.ejecutarAccion('inactivar', comercio);
    component.confirmarOperacion();
    expect(comercio.estatus).toBe('Inactivo');
    component.ejecutarAccion('baja', comercio);
    component.confirmarOperacion();
    expect(comercio.estatus).toBe('Baja definitiva');
  });

  it('conserva la matriz de acciones locales por rol y oculta la columna al rol 6', () => {
    const levels = ['Sub Afiliado', 'Entidad', 'Sucursal', 'Caja'];
    for (const role of [2, 3, 4, 5, 6]) {
      const roleAuth = { hasValidSession: () => true, getUserData: () => ({ idRol: role }) } as unknown as AuthService;
      const component = new ConsultaComerciosComponent({} as Router,
        { buscarComercios: () => of({ commerces: [] }) } as any, {} as RecuperarCuentaService, roleAuth);
      expect(component.mostrarAcciones).toBe(role !== 6);
      expect(component.puedeDarBaja()).toBe(role === 2);
      levels.forEach((nivel, index) => {
        expect(component.puedeInactivar({ nivel } as any)).toBe(index + 3 > role);
        expect(component.puedeConsultarPassword({ nivel } as any)).toBeFalse();
      });
      expect(component.puedeEditarInformacion).toBeFalse();
    }
  });

  it('muestra error de BFF y limpia resultados sin fallback', () => {
    const buscarComercios = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 502 })));
    const component = new ConsultaComerciosComponent({} as Router,
      { buscarComercios } as any, {} as RecuperarCuentaService, auth);
    expect(component.errorConsulta).toContain('No fue posible');
    expect(component.cargando).toBeFalse();
    expect(component.resultados).toEqual([]);
    expect(buscarComercios).toHaveBeenCalledTimes(1);
  });

  it('no renderiza acciones pendientes ni modales aunque exista estado legacy', async () => {
    await TestBed.configureTestingModule({ imports: [ConsultaComerciosComponent], providers: [
      { provide: Router, useValue: {} }, { provide: AuthService, useValue: auth },
      { provide: RecuperarCuentaService, useValue: {} },
      { provide: ConsultaComerciosService, useValue: { buscarComercios: () => of({ success: true, commerces: [
        { ref: 'ref-caja', displayId: 'CAJA-1', nivel: 'Caja', jerarquia: 'Sucursal 2 / Caja 3', status: 'ACTIVO' }
      ] }) } }
    ] }).compileComponents();
    const fixture = TestBed.createComponent(ConsultaComerciosComponent);
    const component = fixture.componentInstance;
    component.accionesAbiertas = 'ref-caja';
    component.modalPassword = component.modalCambiarPassword = component.resultados[0];
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Editar Información');
    expect(text).not.toContain('Consulta Contraseña');
    expect(fixture.nativeElement.querySelector('.modal-card.password')).toBeNull();
    expect(text).toContain('Inactivar');
  });
});
