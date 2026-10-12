import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SipreladService } from './siprelad.service';

describe('SipreladService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra la coincidencia de lista negra dentro de pldResult.response', () => {
    const service = TestBed.inject(SipreladService);
    service.consultarResultadoPld('971a81aa-23cb-42ae-b050-1d9a39122c0b').subscribe(resultados => {
      expect(resultados).toEqual([{
        rfc: 'GHG1505267G2', nombre: 'GRUPO HERCOR GAS SA DE CV',
        fechaRegistro: '2023-07-20', coincidenciaListas: 'Si',
        categoria: 'LISTA NEGRA', fuente: 'SAT INCUMPLIDOS'
      }]);
    });
    const request = TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('getPLDResult'));
    expect(request.request.body).toEqual({ transactionId: '971a81aa-23cb-42ae-b050-1d9a39122c0b' });
    request.flush({ success: true, soapAudit: null, pldResult: {
      id: 7, name: null, companyName: 'GRUPO HERCOR GAS', rfc: 'GHG1505267G2',
      response: [{ nombre: 'GRUPO HERCOR GAS SA DE CV', rfc: 'GHG1505267G2',
        fechaBusqueda: '2023-07-20', categoria: 'LISTA NEGRA', fuente: 'SAT INCUMPLIDOS',
        logError: 'Tiempo de respuesta: 370 ms' }]
    } });
  });
});
