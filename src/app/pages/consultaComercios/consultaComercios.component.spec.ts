import { of } from 'rxjs';
import { ConsultaComerciosComponent } from './consultaComercios.component';
import { ConsultaComerciosService } from '../../services/consulta-comercios.service';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';
import { Router } from '@angular/router';

describe('Filtro de pendientes de revisión', () => {
  function crear(statuses: unknown[], router = {} as Router): ConsultaComerciosComponent {
    const service = { buscarComercios: () => of({ commerces: statuses.map((status, index) => ({
      status, entitySonID: `COM.${index}`, nameCommerce: `Comercio ${index}`, idAffilationLevel: '4'
    })) }) };
    return new ConsultaComerciosComponent(router,
      service as unknown as ConsultaComerciosService, {} as RecuperarCuentaService);
  }

  it('acepta textos con y sin acento y el código 27 numérico o texto', () => {
    const component = crear(['PENDIENTE_REVISIÓN', 'PENDIENTE_REVISION', 27, '27', 'ACTIVO', 'INACTIVO']);
    expect(component.hayPendientesRevision).toBeTrue();
    component.paginaActual = 3;
    component.alternarPendientesRevision();
    expect(component.resultados.length).toBe(4);
    expect(component.resultados.every(item => item.estatus === 'Pendiente de revisión')).toBeTrue();
    expect(component.paginaActual).toBe(1);
    component.alternarPendientesRevision();
    expect(component.resultados.length).toBe(6);
  });

  it('no ofrece el botón si no hay pendientes y restablece el filtro al limpiar', () => {
    expect(crear(['ACTIVO', 'INACTIVO']).hayPendientesRevision).toBeFalse();
    const component = crear([27, 'ACTIVO']);
    component.alternarPendientesRevision();
    component.limpiar();
    expect(component.soloPendientesRevision).toBeFalse();
    expect(component.resultados.length).toBe(2);
  });
  it('abre edición con documentos de Mesa Digital para pendientes, sin convertirlos en prospectos', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = crear([27], router);
    component.ejecutarAccion('editarInformacion', component.resultados[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/registro_cliente'], {
      queryParams: jasmine.objectContaining({
        entitySonID: 'COM.0',
        pendienteRevision: 'true',
        habilitarMesaDigital: 'true',
        esProspecto: 'false'
      })
    });
  });

});
