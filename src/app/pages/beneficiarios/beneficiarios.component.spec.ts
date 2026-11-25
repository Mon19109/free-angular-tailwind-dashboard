import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { of, Subject } from 'rxjs';
import { BeneficiariosService } from '../../services/beneficiarios.service';
import { BeneficiariosComponent } from './beneficiarios.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('Confirmación de eliminación de beneficiarios', () => {
  let component: BeneficiariosComponent;
  let service: jasmine.SpyObj<BeneficiariosService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<BeneficiariosService>('BeneficiariosService', ['eliminarContactos']);
    service.eliminarContactos.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      providers: [{ provide: BeneficiariosService, useValue: service },
        { provide: AuthService, useValue: { getSessionValue: () => null } }]
    });
    component = TestBed.runInInjectionContext(() => new BeneficiariosComponent());
    spyOn(component, 'cargarContactos');
  });

  it('abre el popup sin llamar al servicio y permite cancelar conservando la selección', () => {
    component.idsEliminar.add('1');
    component.eliminarSeleccionados();
    expect(component.mostrarModalConfirmacionEliminacion).toBeTrue();
    expect(service.eliminarContactos).not.toHaveBeenCalled();

    component.cancelarEliminacion();
    component.confirmarEliminacion();
    expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
    expect(component.idsEliminar.has('1')).toBeTrue();
    expect(service.eliminarContactos).not.toHaveBeenCalled();
  });

  for (const ids of [['1'], ['1', '2']]) {
    it(`elimina ${ids.length} beneficiarios únicamente tras confirmar y evita solicitudes duplicadas`, () => {
      const response = new Subject<any>();
      service.eliminarContactos.and.returnValue(response);
      component.idsEliminar = new Set(ids);
      component.eliminarSeleccionados();
      component.idsEliminar.add('otro');

      component.confirmarEliminacion();
      component.confirmarEliminacion();
      expect(service.eliminarContactos).toHaveBeenCalledOnceWith(ids);
      expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
      expect(component.cargando).toBeTrue();

      response.next({ success: true });
      response.complete();
      expect(component.cargarContactos).toHaveBeenCalledTimes(1);
      expect(component.idsEliminar.size).toBe(0);
      expect(component.tipoResultadoEliminacion).toBe('exito');
    });
  }

  it('avisa si no hay selección sin permitir eliminar', () => {
    component.eliminarSeleccionados();
    component.confirmarEliminacion();
    expect(component.mostrarModalConfirmacionEliminacion).toBeFalse();
    expect(component.tipoResultadoEliminacion).toBe('error');
    expect(component.mensajeResultadoEliminacion).toContain('Selecciona al menos');
    expect(service.eliminarContactos).not.toHaveBeenCalled();
  });

  it('mantiene la selección y muestra el error si el servicio rechaza la eliminación', () => {
    service.eliminarContactos.and.returnValue(of({ success: false, message: 'Eliminación rechazada' }));
    component.idsEliminar.add('1');
    component.eliminarSeleccionados();
    component.confirmarEliminacion();
    expect(component.idsEliminar.has('1')).toBeTrue();
    expect(component.cargarContactos).not.toHaveBeenCalled();
    expect(component.cargando).toBeFalse();
    expect(component.tipoResultadoEliminacion).toBe('error');
    expect(component.mensajeResultadoEliminacion).toBe('Eliminación rechazada');
  });
});

describe('Carga inicial de Beneficiarios', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BeneficiariosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).actualizarSesion({
      success: true, authenticated: true, expiresAt: Date.now() + 60000,
      usuario: { idUser: 7, idRol: 2, userName: 'usuario' }
    });
  });
  afterEach(() => http.verify());

  function prepararAlta() {
    const fixture = TestBed.createComponent(BeneficiariosComponent);
    fixture.detectChanges();
    for (const path of ['contactos', 'giros', 'actividades']) {
      http.expectOne(`/api/beneficiarios/${path}`).flush([]);
    }
    fixture.componentInstance.form = {
      ...fixture.componentInstance.form,
      nombre: 'Beneficiario ejemplo', alias: 'Ejemplo', email: 'ejemplo@example.invalid',
      rfc: 'EJEMPLO', direccion: 'Dirección ejemplo', dirBanco: 'Dirección banco',
      tipoBen: 'PF', tipoCuenta: '4', cuenta: '123456789012345678',
      institucion: '40903', actividad: 'Actividad ejemplo'
    };
    return fixture.componentInstance;
  }

  it('guarda con idUser de la sesión y evita altas duplicadas mientras espera respuesta', () => {
    const component = prepararAlta();
    component.agregar(); component.agregar();
    const req = http.expectOne('/api/beneficiarios/contactos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idUser: 7, form: component.form });
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-Portal-Request')).toBe('1');
    expect(component.cargando).toBeTrue();
    req.flush({ success: true });
    expect(component.mostrarModalBeneficiarioAgregado).toBeTrue();
    expect(component.error).toBe('');
    expect(component.cargando).toBeFalse();
  });

  it('actualiza la sesión anterior sin idUser antes de guardar', () => {
    TestBed.inject(AuthService).actualizarSesion({
      success: true, authenticated: true, expiresAt: Date.now() + 60000,
      usuario: { idRol: 2, userName: 'usuario' }
    });
    const component = prepararAlta();
    component.agregar();
    http.expectNone('/api/beneficiarios/contactos');
    http.expectOne('/api/auth/me').flush({
      success: true, authenticated: true, expiresAt: Date.now() + 60000,
      usuario: { idUser: 9, idRol: 2 }
    });
    const req = http.expectOne('/api/beneficiarios/contactos');
    expect(req.request.body.idUser).toBe(9);
    req.flush({ success: true });
  });

  it('no guarda si el servidor no confirma el usuario de sesión', () => {
    TestBed.inject(AuthService).clearSession();
    const component = prepararAlta();
    component.agregar();
    http.expectOne('/api/auth/me').flush({ success: false, authenticated: false });
    http.expectNone('/api/beneficiarios/contactos');
    expect(component.error).toContain('sesión confirmada');
    expect(component.cargando).toBeFalse();
  });

  it('muestra el rechazo del backend sin confirmar el alta', () => {
    const component = prepararAlta();
    component.agregar();
    http.expectOne('/api/beneficiarios/contactos').flush({ message: 'Sesión no autorizada' }, { status: 401, statusText: 'Unauthorized' });
    expect(component.mostrarModalBeneficiarioAgregado).toBeFalse();
    expect(component.error).toBe('Sesión no autorizada');
    expect(component.cargando).toBeFalse();
  });

  it('conserva la validación de campos obligatorios antes de guardar', () => {
    const component = prepararAlta();
    component.form.nombre = '';
    component.agregar();
    http.expectNone('/api/beneficiarios/contactos');
    expect(component.error).toContain('campos obligatorios');
  });

  it('consulta contactos, giros y actividades al abrir la página sin IDs privados', () => {
    const fixture = TestBed.createComponent(BeneficiariosComponent);
    fixture.detectChanges();
    const contactos = http.expectOne('/api/beneficiarios/contactos');
    const giros = http.expectOne('/api/beneficiarios/giros');
    const actividades = http.expectOne('/api/beneficiarios/actividades');
    for (const req of [contactos, giros, actividades]) {
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.headers.has('Authorization')).toBeFalse();
    }
    contactos.flush({ contactResponse: [{ fullName: 'Beneficiario ejemplo', nameAlias: 'Contacto ejemplo' }] });
    giros.flush({ rows: [{ id: 1 }] });
    actividades.flush({ catActividadResponse: [{ id: 2 }] });
    fixture.detectChanges();
    expect(fixture.componentInstance.contactos.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Beneficiario ejemplo');
    expect(fixture.componentInstance.giros.length).toBe(1);
    expect(fixture.componentInstance.actividades.length).toBe(1);
    expect(fixture.componentInstance.cargando).toBeFalse();
  });

  it('conserva giros y actividades si falla contactos y permite reintentarlo', () => {
    const fixture = TestBed.createComponent(BeneficiariosComponent);
    fixture.detectChanges();
    http.expectOne('/api/beneficiarios/contactos').flush({}, { status: 503, statusText: 'Service Unavailable' });
    http.expectOne('/api/beneficiarios/giros').flush([{ id: 1 }]);
    http.expectOne('/api/beneficiarios/actividades').flush([{ id: 2 }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.giros.length).toBe(1);
    expect(fixture.componentInstance.actividades.length).toBe(1);
    expect(fixture.componentInstance.cargando).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar los beneficiarios.');
    expect(fixture.nativeElement.textContent).not.toContain('No hay beneficiarios disponibles.');
    fixture.componentInstance.cargarContactos();
    http.expectOne('/api/beneficiarios/contactos').flush({ contacts: [] });
    fixture.detectChanges();
    expect(fixture.componentInstance.error).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No hay beneficiarios disponibles.');
  });

  it('cancela las consultas de carga al salir de la página', () => {
    const fixture = TestBed.createComponent(BeneficiariosComponent);
    fixture.detectChanges();
    const solicitudes = ['contactos', 'giros', 'actividades'].map(path => http.expectOne(`/api/beneficiarios/${path}`));
    fixture.destroy();
    solicitudes.forEach(req => expect(req.cancelled).toBeTrue());
  });
});
