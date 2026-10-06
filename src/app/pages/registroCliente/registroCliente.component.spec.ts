import { RegistroClienteComponent } from './registroCliente.component';
import { RegistroProspectoClienteComponent } from '../registroProspectoCliente/registroProspectoCliente.component';

describe('RegistroCliente: pasos finales internos', () => {
  function pantalla(pendienteRevision: boolean, nivel = 'entidad') {
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
    Object.defineProperty(component, 'nivelSeleccionado', { value: nivel });
    Object.defineProperty(component, 'seccionesVisibles', {
      value: [{ id: 'comercio', titulo: 'Datos del Comercio' }]
    });
    return component;
  }

  it('añade los pasos finales solamente en pendientes de revisión', () => {
    expect(pantalla(true).pasosVisiblesRegistro.map(paso => paso.id))
      .toEqual(['comercio', 'liquidacion', 'accesos']);
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
      const component = pantalla(true);
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

  it('abre liquidación del mismo nodo solo después de guardar todos los documentos válidos', () => {
    const component = pantalla(true);
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
    expect(component.seccionAbierta).toBe('liquidacion');
    expect(component.nodoSeleccionado).toBe('entidad');
    expect(siguienteNodo).not.toHaveBeenCalled();
  });

  it('ignora clics mientras se guarda la revisión', () => {
    const component = pantalla(true);
    component.guardandoRevisionDocumentos = true;
    const guardar = spyOn(component, 'guardarRevisionDocumentos');
    component.continuarDesdeDocumentos();
    expect(guardar).not.toHaveBeenCalled();
  });
});
