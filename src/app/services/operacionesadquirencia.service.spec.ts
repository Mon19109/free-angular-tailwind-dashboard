import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { cuentaAdquirencia, OperacionesAdquirenciaService } from './operacionesadquirencia.service';

describe('Consulta de operaciones de adquirencia', () => {
  let service: OperacionesAdquirenciaService;
  let http: HttpTestingController;
  let stored: Array<[string, string | null]>;
  beforeEach(() => {
    stored = ['auth_session', 'acquiringId', 'issueId', 'validate'].map(key => [key, localStorage.getItem(key)]);
    stored.forEach(([key]) => localStorage.removeItem(key));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OperacionesAdquirenciaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    stored.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
  });

  it('prioriza idSirio y acepta account del PHP sin aceptar cero', () => {
    expect(cuentaAdquirencia({ idSirio: 'SIRIO', account: 'PHP' })).toBe('SIRIO');
    expect(cuentaAdquirencia({ idSirio: 0, account: 'PHP' })).toBe('PHP');
    expect(cuentaAdquirencia({ account: 0 })).toBe('');
  });

  it('envía cuenta, filtros múltiples y página con el contrato del PHP', () => {
    service.enviarFormulario({ idSirioConsulta: 'PHP-84', tipoOperacion: ['1', '10008'],
      estatus: ['15', '31'], fechaInicio: '2023-09-01 00:00', fechaFin: '2023-09-30 23:59'
    }, 2).subscribe();
    const req = http.expectOne(request => request.url.endsWith('/PHP-84/getoperationbytypeandstatuscustom'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('1,10008');
    expect(req.request.params.get('status')).toBe('15,31');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('dateInit')).toBe('2023-09-01 00:00');
    expect(req.request.params.get('dateFinish')).toBe('2023-09-30 23:59');
    req.flush({ operations: [] });
  });

  it('no consulta emisión ni el GUID si falta la cuenta de adquirencia', () => {
    localStorage.setItem('issueId', 'EMISION');
    localStorage.setItem('validate', 'GUID');
    const error = jasmine.createSpy('error');
    service.enviarFormulario({}).subscribe({ error });
    expect(error).toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('prefiere la cuenta de la sesión actual a valores legacy', () => {
    localStorage.setItem('auth_session', JSON.stringify({ acquiringId: 'ACTUAL' }));
    localStorage.setItem('acquiringId', 'ANTERIOR');
    expect(service.obtenerCuentaSesion()).toBe('ACTUAL');
  });
});
