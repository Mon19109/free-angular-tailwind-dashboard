import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OperacionesEmisionService } from './operacionesemision.service';
import { TransaccionesEmisionService } from './transaccionesemision.service';

describe('Rutas de entidades y concentradoras de Emisión', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('ambas pantallas consultan entidades con la sesión del servidor', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('No leer IDs ni tokens del almacenamiento');
    for (const service of [TestBed.inject(OperacionesEmisionService), TestBed.inject(TransaccionesEmisionService)]) {
      service.obtenerCuentas().subscribe(value => expect(value.length).toBe(1));
      const request = http.expectOne('/api/transacciones-emision/cuentas');
      expect(request.request.withCredentials).toBeTrue();
      expect(request.request.params.keys()).toEqual([]);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush([{ type: '4', active: true, account: 'CUENTA' }]);
    }
  });

  it('concentradoras usa el prefijo con guion sin enviar sirioId del navegador', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('No leer IDs ni tokens del almacenamiento');
    TestBed.inject(OperacionesEmisionService).obtenerConcentratorAccounts().subscribe();
    const request = http.expectOne('/api/operaciones-emision/cuentas-concentradoras');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ cuentas: [] });
  });

  it('rechaza formatos de entidades desconocidos', () => {
    TestBed.inject(TransaccionesEmisionService).obtenerCuentas().subscribe({
      next: () => fail('Se esperaba error de formato'),
      error: error => expect(error.message).toContain('Formato de entidades')
    });
    http.expectOne('/api/transacciones-emision/cuentas').flush({ success: true });
  });
});
