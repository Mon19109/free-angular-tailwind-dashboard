import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NgxTailwindModalService } from '@dotted-labs/ngx-tailwind-modal';
import { LoginComponent } from './login.component';
import { GeolocationService } from '../../services/geolocation.service';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent con SMS BFF', () => {
  let component: LoginComponent; let http: HttpTestingController; let router: jasmine.SpyObj<Router>;
  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: GeolocationService, useValue: { getCurrentLocation: () => Promise.resolve({ latitude: 1, longitude: 2 }) } },
      { provide: NgxTailwindModalService, useValue: {} }
    ] });
    component = TestBed.createComponent(LoginComponent).componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('abre SMS tras login sin navegar ni autenticar', async () => {
    component.loginForm.setValue({ userLogin: 'usuario@example.test', passwordLogin: 'prueba' });
    component.onSubmit();
    // Completar la geolocalización simulada antes de inspeccionar la petición.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/auth/login').flush({ success: true, os: 1, oft: '34' });
    expect(component.showTokenModal).toBeTrue(); expect(component.telModal).toBe('34');
    expect(TestBed.inject(AuthService).hasValidSession()).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('no navega cuando SMS devuelve success sin authenticated', () => {
    component.tokenValue = '123456'; component.validateToken();
    http.expectOne('/api/auth/verify-sms').flush({ success: true });
    expect(router.navigate).not.toHaveBeenCalled(); expect(component.showTokenModal).toBeTrue();
  });
  it('navega solo con sesión SMS vigente y limpia contraseña/código', () => {
    component.loginForm.controls['passwordLogin'].setValue('prueba');
    component.tokenValue = '123456'; component.validateToken();
    http.expectOne('/api/auth/verify-sms').flush({ success: true, authenticated: true, expiresAt: Date.now() + 600000, usuario: { idRol: 2 } });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.tokenValue).toBe(''); expect(component.loginForm.controls['passwordLogin'].value).toBeNull();
  });
  it('permite reintentar un código incorrecto sin reenviar credenciales', () => {
    component.tokenValue = '123456'; component.validateToken();
    http.expectOne('/api/auth/verify-sms').flush({ success: false }, { status: 400, statusText: 'Invalid code' });
    expect(component.tokenErrorMessage).toBe('Código incorrecto');
    expect(component.mostrarReenvioToken).toBeFalse(); expect(router.navigate).not.toHaveBeenCalled();
  });
});
