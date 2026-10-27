import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
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
      const getToken = TestBed.inject(AuthService).getToken;
      if (!jasmine.isSpy(getToken)) spyOn(TestBed.inject(AuthService), 'getToken').and.returnValue(token);
      else (getToken as jasmine.Spy).and.returnValue(token);
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
    localStorage.setItem('token', 'token-local-no-confiable');
    spyOn(localStorage, 'getItem').and.throwError('No leer storage');
    const error = jasmine.createSpy('error');
    service.actualizar({ commerceGuid: 'comercio' }).subscribe({ error });
    expect(error).toHaveBeenCalled();
    http.expectNone(() => true);
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });
  it('propaga el rechazo del servicio aunque HTTP sea 200', () => {
    spyOn(TestBed.inject(AuthService), 'getToken').and.returnValue('sesion');
    const error = jasmine.createSpy('error');
    service.actualizar({ commerceGuid: 'comercio' }).subscribe({ error });
    http.expectOne(`${environment.api.KashpayCoreAPI}merchant/updateData`).flush({ success: false, message: 'No actualizado' });
    expect(error).toHaveBeenCalled();
  });
});
