import { RegistroClienteComponent } from './registroCliente.component';
import { RegistroProspectoClienteComponent } from '../registroProspectoCliente/registroProspectoCliente.component';

describe('RegistroCliente: pasos finales internos', () => {
  function pantalla(pendienteRevision: boolean, nivel = 'entidad', mesaDigital = false) {
    const component = Object.create(RegistroClienteComponent.prototype) as RegistroClienteComponent;
    Object.assign(component, {
      pendienteRevisionEdicion: pendienteRevision,
      nodeIDEdicion: 'nodo-entidad',
      secciones: [
        { id: 'comercio', titulo: 'Datos del Comercio' },
        { id: 'liquidacion', titulo: 'Cuenta de Liquidación' },
        { id: 'accesos', titulo: 'Accesos a Plataforma' }
      ]
    });
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
    Object.defineProperty(component, 'nivelSeleccionado', { value: nivel });
    Object.defineProperty(component, 'seccionesVisibles', {
      value: [{ id: 'comercio', titulo: 'Datos del Comercio' }]
    });
    return component;
  }

  it('añade los pasos finales solamente en pendientes de revisión', () => {
    expect(pantalla(true).pasosVisiblesRegistro.map(paso => paso.id))
      .toEqual(['liquidacion', 'accesos', 'comercio']);
    expect(pantalla(false).pasosVisiblesRegistro.map(paso => paso.id)).toEqual(['comercio']);
    expect(pantalla(true, 'caja').pasosVisiblesRegistro.map(paso => paso.id)).toEqual(['comercio']);
  });

  it('no permite cambiar de nodo durante el envío de liquidación o accesos', () => {
    const component = pantalla(true);
    component.nodoSeleccionado = 'entidad';
    component.registroFinal = { guardandoLiquidacion: true } as RegistroProspectoClienteComponent;
    component.seleccionarNodo({ id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal' });
    expect(component.nodoSeleccionado).toBe('entidad');
    component.registroFinal = { guardando: true } as RegistroProspectoClienteComponent;
    component.seleccionarNodo({ id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal' });
    expect(component.nodoSeleccionado).toBe('entidad');
  });

  for (const estados of [[], ['IN_REVIEW'], ['APPROVED', 'REJECTED'], ['APPROVED', '']]) {
    it(`impide continuar con documentos incompletos o sin aprobar: ${JSON.stringify(estados)}`, () => {
      const component = pantalla(true, 'entidad', true);
      component.documentosProspecto = estados.map(status => ({ status }));
      const modal = spyOn<any>(component, 'mostrarModalRegistro');
      const guardar = spyOn(component, 'guardarRevisionDocumentos');
      const completar = spyOn(component, 'completarPaso');

      component.continuarDesdeDocumentos();

      expect(modal).toHaveBeenCalled();
      expect(guardar).not.toHaveBeenCalled();
      expect(completar).not.toHaveBeenCalled();
    });
  }

  it('concluye la revisión sin abrir liquidación para Mesa Digital', () => {
    const component = pantalla(true, 'entidad', true);
    spyOn<any>(component, 'mostrarModalRegistro');
    component.nodoSeleccionado = 'entidad';
    component.seccionAbierta = 'documentos';
    component.documentosProspecto = [{ status: 'APPROVED' }, { documentStatus: 'APPROVED' }];
    let alGuardar: (() => void) | undefined;
    spyOn(component, 'guardarRevisionDocumentos').and.callFake((_finalizar, callback) => {
      alGuardar = callback;
    });
    const completar = spyOn(component, 'completarPaso');
    const siguienteNodo = spyOn(component, 'seleccionarSiguienteNodoArbol');

    component.continuarDesdeDocumentos();

    expect(component.seccionAbierta).toBe('documentos');
    expect(completar).not.toHaveBeenCalled();
    expect(alGuardar).toBeDefined();
    alGuardar!();
    expect(completar).toHaveBeenCalledWith('documentos');
    expect(component.seccionAbierta).toBe('documentos');
    expect(component.nodoSeleccionado).toBe('entidad');
    expect(siguienteNodo).not.toHaveBeenCalled();
  });

  it('muestra únicamente documentación al revisor y captura final a los otros roles', () => {
    for (const mesaDigital of [true, false]) {
      const component = Object.create(RegistroClienteComponent.prototype) as RegistroClienteComponent;
      Object.assign(component, {
        pendienteRevisionEdicion: true, nodeIDEdicion: 'SUCURSAL-1',
        secciones: ['comercio', 'datos', 'liquidacion', 'accesos', 'documentos'].map(id => ({ id, titulo: id }))
      });
      Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
      Object.defineProperty(component, 'nivelSeleccionado', { value: 'sucursal' });
      expect(component.seccionesVisibles.map(item => item.id)).toEqual(['documentos']);
      expect(component.pasosVisiblesRegistro.map(item => item.id)).toEqual(
        mesaDigital ? ['documentos'] : ['liquidacion', 'accesos', 'documentos']);
      expect(component.documentacionSoloConsulta).toBe(!mesaDigital);
      expect(component.mostrarCapturaFinalPendiente).toBe(!mesaDigital);
    }
  });

  it('no marca documentación concluida con avances locales sin aprobación', () => {
    const component = pantalla(true);
    spyOn(component, 'documentosNodoValidados').and.returnValue(false);
    spyOn(component, 'pasoCompletado').and.returnValue(true);
    expect(component.estadoPaso('documentos')).toBe('Pendiente de revisión');
    expect(component.pasoTerminado('documentos')).toBeFalse();
    (component.documentosNodoValidados as jasmine.Spy).and.returnValue(true);
    expect(component.estadoPaso('documentos')).toBe('Concluida');
  });

  it('no permite continuar la revisión desde un rol de captura', () => {
    const component = pantalla(true);
    const guardar = spyOn(component, 'guardarRevisionDocumentos');
    component.continuarDesdeDocumentos();
    expect(guardar).not.toHaveBeenCalled();
  });

  for (const estados of [[], ['IN_REVIEW'], ['APPROVED', 'REJECTED'], ['APPROVED', ''], ['APPROVED', 'APPROVED']]) {
    it(`habilita la captura final solamente con toda la documentación aprobada: ${JSON.stringify(estados)}`, () => {
      const component = pantalla(true, 'sucursal');
      component.nodoSeleccionado = 'sucursal';
      component.documentosProspecto = estados.map(status => ({ status }));
      spyOn<any>(component, 'buscarNodo').and.returnValue({ nivel: 'sucursal' });
      Object.defineProperty(component, 'arbol', { value: [] });

      expect(component.capturaFinalHabilitada).toBe(estados.length > 0 && estados.every(estado => estado === 'APPROVED'));

      component.cargandoDocumentosProspecto = true;
      expect(component.capturaFinalHabilitada).toBeFalse();
      component.cargandoDocumentosProspecto = false;
      component.errorDocumentosProspecto = 'No fue posible consultar los documentos';
      expect(component.capturaFinalHabilitada).toBeFalse();
    });
  }

  it('ignora clics mientras se guarda la revisión', () => {
    const component = pantalla(true);
    component.guardandoRevisionDocumentos = true;
    const guardar = spyOn(component, 'guardarRevisionDocumentos');
    component.continuarDesdeDocumentos();
    expect(guardar).not.toHaveBeenCalled();
  });
});
