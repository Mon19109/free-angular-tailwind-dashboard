import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperacionesEmisionService } from './operacionesemision.service';

describe('Autenticación del detalle de liquidación', () => {
  it('envía el Bearer de sesión y la referencia seleccionada', () => {
    const anteriores = ['auth_session', 'idUser', 'nodeID'].map(key => [key, localStorage.getItem(key)] as const);
    localStorage.setItem('idUser', '123');
    localStorage.setItem('nodeID', '83');
    localStorage.setItem('auth_session', JSON.stringify({ token: 'token-prueba' }));
    try {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      const http = TestBed.inject(HttpTestingController);
      TestBed.inject(OperacionesEmisionService).obtenerDetalleOperacion('com.onsigna-20230905', {
        startDate: '2023-09-01 00:00', endDate: '2023-09-30 23:59', type: '10008', status: '31'
      }).subscribe();
      const req = http.expectOne(request => request.url.endsWith('/operations/searchOperations'));
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-prueba');
      expect(req.request.params.get('liquidationID')).toBe('com.onsigna-20230905');
      expect(req.request.params.get('userID')).toBe('123');
      expect(req.request.params.get('rootNodeID')).toBe('83');
      for (const campo of ['amount', 'amountFrom', 'amountTo', 'email',
        'responseCode', 'page', 'searchBy']) {
        expect(req.request.params.get(campo)).toBe('');
      }
      for (const campo of ['idContext', 'idEntity', 'idTerminal', 'idTerminalUser']) {
        expect(req.request.params.has(campo)).toBeFalse();
      }
      expect(req.request.params.get('startDate')).toBe('2023-09-01 00:00');
      expect(req.request.params.get('endDate')).toBe('2023-09-30 23:59');
      expect(req.request.params.get('typeOperation')).toBe('10008');
      expect(req.request.params.get('type')).toBe('10008');
      expect(req.request.params.get('status')).toBe('31');
      req.flush({ rows: [] });
      http.verify();
    } finally {
      for (const [key, value] of anteriores) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    }
  });
  it('consulta la entidad elegida y solicita diez registros de la página indicada', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(OperacionesEmisionService).enviarFormulario({
      cuenta: 'CUENTA-SUCURSAL', tipoOperacion: '10008', estatus: '31',
      fechaInicio: '2023-09-01 00:00', fechaFin: '2023-09-30 23:59'
    }, 2).subscribe();
    const req = http.expectOne(request => request.url.endsWith('/CUENTA-SUCURSAL/getoperationbytypeandstatuscustom'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('type')).toBe('10008');
    expect(req.request.params.get('dateInit')).toBe('2023-09-01 00:00');
    req.flush({ operations: [], totalItems: 20 });
    http.verify();
  });

});
