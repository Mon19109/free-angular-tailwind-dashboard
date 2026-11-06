import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FiltroReporte, ReportesService } from './reportes.service';

describe('ReportesService BFF', () => {
  let service: ReportesService;
  let http: HttpTestingController;
  const filtro: FiltroReporte = { periodo: '2026 Octubre', tipoCuenta: 'Cuenta Adquirente', guid: 'guid-de-cuenta', cuenta: 'sirio-de-cuenta' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReportesService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('usa exclusivamente los contratos BFF con cookies, sin Bearer del navegador', () => {
    service.obtenerCuentas().subscribe();
    const cuentas = http.expectOne('/api/reportes/cuentas');
    expect(cuentas.request.method).toBe('GET');
    expect(cuentas.request.params.keys()).toEqual([]);
    expect(cuentas.request.withCredentials).toBeTrue();
    expect(cuentas.request.headers.has('Authorization')).toBeFalse();
    cuentas.flush({ cuentas: [] });
    service.buscar(filtro).subscribe();
    service.buscarReporte(filtro, 'EnRed').subscribe();
    for (const path of ['buscar', 'buscar-reporte']) {
      const request = http.expectOne(`/api/reportes/${path}`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(path === 'buscar' ? filtro : { ...filtro, reporte: 'EnRed' });
      expect(request.request.withCredentials).toBeTrue();
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({ rows: [] });
    }
  });
  it('recibe archivos binarios, no JSON/Base64', () => {
    const archivo = new Blob(['pdf'], { type: 'application/pdf' });
    let result: Blob | undefined;
    service.descargar('estado-pdf', { periodo: filtro.periodo, cuenta: filtro.cuenta, clabe: '' }).subscribe(value => result = value);
    const request = http.expectOne('/api/reportes/descargar');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.body).toEqual({ tipo: 'estado-pdf', periodo: filtro.periodo, cuenta: filtro.cuenta, clabe: '' });
    request.flush(archivo); expect(result).toBe(archivo);
  });
});
