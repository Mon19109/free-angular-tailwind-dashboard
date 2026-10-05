import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PagarLinkPagoService, UbicacionPago } from './pagarlinkpago.service';

describe('PagarLinkPagoService', () => {
  let service: PagarLinkPagoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PagarLinkPagoService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PagarLinkPagoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the entity balance using the order sirioID', () => {
    service.obtenerBalance('SIRIO-9').subscribe();

    const balance = http.expectOne(request => request.url.includes('/EntitiesServices/') && request.url.endsWith('/getBalance'));
    expect(balance.request.method).toBe('GET');
    expect(balance.request.headers.get('SonEntity-i')).toBe('SIRIO-9');
    expect(balance.request.headers.get('Entity-i')).toBe('com.onsigna');
    expect(balance.request.headers.get('versionApp')).toBe('3');
    expect(balance.request.headers.get('Authorization')).toMatch(/^Bearer /);
    balance.flush({ availableBalance: 100 });
  });

  it('reuses the location requested on page load when processing the payment', () => {
    const ubicacion = new Subject<UbicacionPago>();
    const obtenerUbicacion = spyOn(service, 'obtenerUbicacion').and.returnValue(ubicacion);

    service.precargarUbicacion().subscribe();
    service.procesarTransaccion({ itInformation: { model: 'browser' } }).subscribe();

    expect(obtenerUbicacion).toHaveBeenCalledTimes(1);
    http.expectNone(request => request.url.endsWith('processTransaction'));

    ubicacion.next({ latitud: '19.43', longitud: '-99.13' });
    ubicacion.complete();

    const pago = http.expectOne(request => request.url.endsWith('processTransaction'));
    expect(pago.request.body.itInformation).toEqual({
      model: 'browser', latitude: '19.43', longitude: '-99.13'
    });
    pago.flush({ success: true });
  });
});
