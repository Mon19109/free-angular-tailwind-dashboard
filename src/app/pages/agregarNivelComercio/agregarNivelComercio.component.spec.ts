import { AgregarNivelComercioComponent } from './agregarNivelComercio.component';
import { ConsultaComercioApi } from '../../services/consulta-comercios.service';

describe('Árbol de agregar nivel: pendientes de revisión', () => {
  const component = Object.create(AgregarNivelComercioComponent.prototype) as AgregarNivelComercioComponent;

  it('reconoce el estado numérico y ambas variantes de revisión', () => {
    for (const status of [27, '27', 'PENDIENTE_REVISIÓN', 'PENDIENTE_REVISION']) {
      expect(component['esPendienteRevision']({ status } as ConsultaComercioApi)).toBeTrue();
    }
    expect(component['esPendienteRevision']({ status: 'ACTIVO' })).toBeFalse();
  });

  it('excluye pendientes del árbol por nodeID o entitySonID, conservando los demás', () => {
    const nodos = [
      { id: '1', nodeID: '1', llave: '1', nombre: 'Raíz', nivel: 'Sub Afiliado' as const, hijos: [
        { id: '2', nodeID: '2', llave: '2', nombre: 'Pendiente', nivel: 'Entidad' as const, hijos: [] },
        { id: '3', entitySonID: 'COM.3', llave: '3', nombre: 'Pendiente', nivel: 'Entidad' as const, hijos: [] },
        { id: '4', nodeID: '4', llave: '4', nombre: 'Activo', nivel: 'Entidad' as const, hijos: [] }
      ] }
    ];
    const resultado = component['excluirPendientesDelArbol'](nodos, [
      { nodeID: '2', status: '27' }, { entitySonID: 'COM.3', status: 'PENDIENTE_REVISIÓN' }
    ]);
    expect(resultado[0].hijos.map(nodo => nodo.id)).toEqual(['4']);
    expect(nodos[0].hijos.length).toBe(3);
  });
});
