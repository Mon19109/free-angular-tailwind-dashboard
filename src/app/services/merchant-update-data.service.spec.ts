import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MerchantUpdateDataService } from './merchant-update-data.service';
import { environment } from '../environments/environments';

describe('MerchantUpdateDataService', () => {
  let service: MerchantUpdateDataService;
  let http: HttpTestingController;
  let stored: Array<[string, string | null]>;
  beforeEach(() => {
    stored = ['auth_session', 'token', 'auth_token'].map(key => [key, localStorage.getItem(key)]);
    stored.forEach(([key]) => localStorage.removeItem(key));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MerchantUpdateDataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    stored.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
  });
  it('usa PUT, el environment y el bearer actual de sesión', () => {
    for (const token of ['sesion-uno', 'sesion-dos']) {
      localStorage.setItem('auth_session', JSON.stringify({ token }));
      const payload = { commerceGuid: 'nodo-seleccionado', nameCommerce: 'Nombre actualizado' };
      service.actualizar(payload).subscribe();
      const req = http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      expect(req.request.headers.get('versionApp')).toBe('3');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true });
    }
  });
  it('no envía sin sesión', () => {
    const error = jasmine.createSpy('error');
    service.actualizar({ commerceGuid: 'comercio' }).subscribe({ error });
    expect(error).toHaveBeenCalled();
    http.expectNone(() => true);
  });
  it('propaga el rechazo del servicio aunque HTTP sea 200', () => {
    localStorage.setItem('token', 'sesion');
    const error = jasmine.createSpy('error');
    service.actualizar({ commerceGuid: 'comercio' }).subscribe({ error });
    http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`).flush({ success: false, message: 'No actualizado' });
    expect(error).toHaveBeenCalled();
  });
});
