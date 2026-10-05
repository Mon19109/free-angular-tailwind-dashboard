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
});
