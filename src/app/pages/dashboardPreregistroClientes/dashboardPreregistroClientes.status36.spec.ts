import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConsultaComerciosService } from '../../services/consulta-comercios.service';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';
import { DashboardPreregistroClientesComponent } from './dashboardPreregistroClientes.component';

describe('Dashboard: nueve pasos de preregistro', () => {
  let component: DashboardPreregistroClientesComponent;
  let profile = 1;
  beforeEach(() => {
    profile = 1;
    TestBed.configureTestingModule({ imports: [DashboardPreregistroClientesComponent], providers: [
      { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      { provide: AuthService, useValue: { hasValidSession: () => true, getUserData: () => ({ idRol: 2 }), getSessionValue: () => profile } },
      { provide: ConsultaComerciosService, useValue: { buscarComercios: () => of({ success: true, commerces: [] }) } },
      { provide: RecuperarCuentaService, useValue: {} }
    ] });
    component = TestBed.createComponent(DashboardPreregistroClientesComponent).componentInstance;
  });
  it('mapea estatus, nombres y colores, agrupando 30 y 35', () => {
    const map = (value: unknown) => (component as any).obtenerPasoPorEstatus(value);
    expect(component.pasosPreregistro.length).toBe(9);
    [25, 26, 30, 31, 33, 36, 34, 19, 'PENDIENTE_FIRMA_CONTRATO'].forEach((status, i) => expect(map(status)).toBe(i + 1));
    expect(map(35)).toBe(3); expect(map('EN REVISIÓN DOCUMENTACIÓN')).toBe(3);
    expect(map('PENDIENTE ACCESOS A PLATAFORMA')).toBe(6);
    expect(map('PENDIENTE_DE_AFILIACION')).toBe(7);
    expect(map('PENDIENTE_FIRMA_DE_CONTRATO')).toBe(9);
    expect(component.pasosPreregistro[5].color).toBe('#06b6d4');
    expect(component.pasosPreregistro[6].color).toBe('#f97316');
  });
  it('contadores y filtro por tarjeta agrupan los comercios correctos', () => {
    component.comercios = [25, 26, 30, 35, 31, 33, 36, 34, 19].map((status, i) => ({
      idComercio: String(i), ref: String(i), nivel: 'Sucursal', nombreComercial: 'Fixture', razonSocial: '', rfc: '', correo: '', telefono: '',
      jerarquia: '', estatus: String(status), statusOriginal: String(status)
    }));
    (component as any).cargarTotalesPasos();
    expect(component.totalPaso(3)).toBe(2); expect(component.totalPaso(6)).toBe(1);
    component.seleccionarPaso(6); expect(component.resultados.map(row => row.statusOriginal)).toEqual(['36']);
    component.seleccionarPaso(3); expect(component.resultados.map(row => row.statusOriginal).sort()).toEqual(['30', '35']);
    component.seleccionarPaso(7); expect(component.resultados.map(row => row.statusOriginal)).toEqual(['34']);
  });
  it('Registro Afiliación sigue exclusivo de 34 y respeta perfil de consulta', () => {
    const row = (status: string) => ({ ref: 'opaque', statusOriginal: status }) as any;
    expect(component.puedeRegistrarAfiliacion(row('34'))).toBeTrue();
    expect(component.puedeRegistrarAfiliacion(row('36'))).toBeFalse();
    expect(component.puedeRegistrarAfiliacion(row('PENDIENTE ACCESOS A PLATAFORMA'))).toBeFalse();
    profile = 11; expect(component.puedeRegistrarAfiliacion(row('34'))).toBeFalse();
  });
});
