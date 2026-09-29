import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { OperacionesAdquirenciaComponent } from './operacionesAdquirencia.component';
import { OperacionesAdquirenciaService } from '../../services/operacionesadquirencia.service';

describe('Niveles de Operaciones adquirencia', () => {
  let component: OperacionesAdquirenciaComponent;
  let service: jasmine.SpyObj<OperacionesAdquirenciaService>;
  let originalUrl: string;
  let stored: Array<[string, string | null]>;
  beforeEach(() => {
    originalUrl = window.location.href;
    window.history.replaceState(null, '', window.location.pathname);
    stored = ['nodeID', 'idRol', 'auth_session'].map(key => [key, localStorage.getItem(key)]);
    localStorage.removeItem('auth_session');
    localStorage.setItem('nodeID', '83');
    localStorage.setItem('idRol', '3');
    service = jasmine.createSpyObj('OperacionesAdquirenciaService', [
      'getSubafiliadoById', 'getSubafiliados', 'getEntidades', 'getSucursales', 'getCajas',
      'obtenerTiposOperacion', 'obtenerStatus', 'enviarFormulario', 'obtenerCuentaSesion'
    ]);
    service.obtenerCuentaSesion.and.returnValue('SESION-83');
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
  afterEach(() => {
    window.history.replaceState(null, '', originalUrl);
    stored.forEach(([key, value]) => {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  });
  });

  it('consulta los cuatro niveles al iniciar desde el subafiliado', () => {
    expect(service.getSubafiliadoById).toHaveBeenCalledTimes(1);
    expect(service.getEntidades).toHaveBeenCalledOnceWith('83');
    expect(service.getSucursales).toHaveBeenCalledOnceWith('83');
    expect(service.getCajas).toHaveBeenCalledOnceWith('83');
    expect(component.sucursales.length).toBe(1);
    expect(component.cajas.length).toBe(1);
  });

  it('carga el siguiente nivel y limpia descendientes al cambiar el padre, como operaciones2.js', () => {
    service.getCajas.calls.reset();
    component.formulario.patchValue({ entidad: '84' });
    expect(service.getSucursales).toHaveBeenCalledWith('84');
    expect(service.getCajas).not.toHaveBeenCalled();
    expect(component.cajas).toEqual([]);
    component.formulario.patchValue({ sucursal: '85' });
    expect(service.getCajas).toHaveBeenCalledWith('85');
    service.getSucursales.calls.reset();
    component.formulario.patchValue({ entidad: '' });
    expect(service.getSucursales).not.toHaveBeenCalled();
    expect(component.sucursales).toEqual([]);
    expect(component.cajas).toEqual([]);
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
    it(`envía el idSirio de ${campo} aunque account sea cero y conserva filtros al paginar`, () => {
      component.rolId = '2';
      component.cuentas = [{ idNode: 83, idSirio: 'SUB-83', account: '0' }];
      component.entidades = [{ idNode: 84, idSirio: 'ENT-84', account: '0' }];
      component.sucursales = [{ idNode: 85, idSirio: 'SUC-85', account: '0' }];
      component.cajas = [{ idNode: 86, idSirio: 'CAJA-86', account: '0' }];
      component.formulario.patchValue({ cuenta: '83', entidad: '', sucursal: '', caja: '',
        fechaInicio: '2023-09-01 00:00', fechaFin: '2023-09-30 23:59', [campo]: id
      }, { emitEvent: false });
      component.onSubmit();
      expect(service.enviarFormulario.calls.mostRecent().args[0].idSirioConsulta).toBe(cuenta);
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

  it('rechaza una selección sin idSirio en lugar de consultar entities/0', () => {
    component.rolId = '2';
    component.entidades = [{ idNode: 258, account: '0', levelType: 4 }];
    component.formulario.patchValue({ entidad: '258', fechaInicio: '2023-09-01 00:00',
      fechaFin: '2023-09-30 23:59' }, { emitEvent: false });
    component.onSubmit();
    expect(service.enviarFormulario).not.toHaveBeenCalled();
    expect(component.fechaErrorMensaje).toContain('idSirio');
  });

  it('muestra los cuatro filtros para todos los roles como la vista PHP', () => {
    for (const rol of ['2', '3', '4', '5', '6']) {
      component.rolId = rol;
      expect(['cuenta', 'entidad', 'sucursal', 'caja'].every(campo => component.mostrarFiltro(campo))).toBeTrue();
    }
  });

  it('acepta account de los nodos PHP cuando no existe idSirio', () => {
    component.entidades = [{ idNode: 84, account: 'PHP-84' }];
    component.formulario.patchValue({ entidad: '84', fechaInicio: '2023-09-01 00:00',
      fechaFin: '2023-09-30 23:59' }, { emitEvent: false });
    component.onSubmit();
    expect(service.enviarFormulario.calls.mostRecent().args[0].idSirioConsulta).toBe('PHP-84');
  });

  it('usa acquiringId de sesión para el nodo propio sin cuenta en el árbol', () => {
    component.formulario.patchValue({ fechaInicio: '2023-09-01 00:00',
      fechaFin: '2023-09-30 23:59' }, { emitEvent: false });
    component.onSubmit();
    expect(service.enviarFormulario.calls.mostRecent().args[0].idSirioConsulta).toBe('SESION-83');
  });

  it('permite al administrador cambiar su subafiliado y bloquea el nivel propio de otros roles', () => {
    for (const [rol, bloqueados] of [
      ['2', []], ['3', ['cuenta']], ['4', ['cuenta', 'entidad']],
      ['5', ['cuenta', 'entidad', 'sucursal']], ['6', ['cuenta', 'entidad', 'sucursal', 'caja']]
    ] as Array<[string, string[]]>) {
      component.rolId = rol;
      (component as any).aplicarBloqueosSesion();
      for (const campo of ['cuenta', 'entidad', 'sucursal', 'caja']) {
        expect(component.formulario.get(campo)?.disabled).toBe(bloqueados.includes(campo));
      }
    }
  });

  it('rechaza fechas inválidas sin consultar el servicio', () => {
    component.formulario.patchValue({ fechaInicio: 'fecha inválida', fechaFin: '2023-09-30 23:59' });
    component.onSubmit();
    expect(service.enviarFormulario).not.toHaveBeenCalled();
    expect(component.fechaErrorMensaje).toContain('fechas válidas');
  });

  it('restaura enlaces PHP sin exigir el parámetro nodoSesion de Angular', () => {
    const params = new URLSearchParams({ type: '1,10008', status: '15,31', page: '2',
      dateInit: '2023-09-01 00:00', dateFinish: '2023-09-30 23:59',
      subafiliado: '83', entidad: '0', sucursal: '0', caja: '0', validate: 'CUENTA-PHP' });
    window.history.replaceState(null, '', '?' + params);
    (component as any).restaurarBusqueda();
    expect(service.enviarFormulario.calls.mostRecent().args[1]).toBe(1);
    expect(component.formulario.getRawValue().entidad).toBe('');
    expect(component.formulario.getRawValue().tipoOperacion).toEqual(['1', '10008']);
    expect(component.paginaActual).toBe(2);
  });

  it('limpiar restaura fechas consultadas y valores predeterminados, luego vuelve a consultar', () => {
    component.formulario.patchValue({ fechaInicio: '2023-09-01 00:00', fechaFin: '2023-09-30 23:59' });
    component.onSubmit();
    component.formulario.patchValue({ fechaInicio: '2024-01-01 00:00', clasificacion: '22', tipoOperacion: ['10'] });
    component.limpiarFormulario();
    const [filtros, pagina] = service.enviarFormulario.calls.mostRecent().args;
    expect(filtros.fechaInicio).toBe('2023-09-01 00:00');
    expect(filtros.tipoOperacion).toEqual(['10007', '1', '10008']);
    expect(filtros.estatus).toEqual(['15', '31', '27']);
    expect(filtros.clasificacion).toBe('');
    expect(pagina).toBe(0);
  });

  it('no exige subafiliado cuando se selecciona un nivel inferior', () => {
    component.entidades = [{ idNode: 84, account: 'ENT-84' }];
    component.formulario.patchValue({ cuenta: '', entidad: '84', fechaInicio: '2023-09-01 00:00',
      fechaFin: '2023-09-30 23:59' }, { emitEvent: false });
    component.onSubmit();
    expect(service.enviarFormulario.calls.mostRecent().args[0].idSirioConsulta).toBe('ENT-84');
  });

  it('abre el detalle con la referencia de liquidación sin filtros agregados', () => {
    component.verTicket({ type: 10008, numericReference: 'LIQ-7', status: 31 });
    expect(component.liquidacionSeleccionada).toEqual({ referencia: 'LIQ-7', filtros: {} });
  });

  it('conserva segmentos vacíos al extraer el concepto del comprobante PHP', () => {
    component.verTicket({ type: 1, description: 'origen||Concepto correcto', amount: 10 });
    expect(component.comprobanteOperacion.concepto).toBe('Concepto correcto');
  });

});
