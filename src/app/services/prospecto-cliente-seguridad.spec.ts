import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProspectoClienteService } from './prospecto-cliente.service';
import { authTokenInterceptor } from './auth-token.interceptor';
import { ActivatedRoute } from '@angular/router';
import { RegistroProspectoClienteComponent } from '../pages/registroProspectoCliente/registroProspectoCliente.component';
import {
  SEGUIMIENTO_NAVIGATION_COORDINATOR,
  SEGUIMIENTO_NAVIGATION_TYPE,
  SeguimientoNavigationService
} from './seguimiento-navigation.service';
import { of } from 'rxjs';

describe('Seguimiento público: transporte y límites de autorización', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting(),
      { provide: SEGUIMIENTO_NAVIGATION_TYPE, useValue: 'navigate' },
      { provide: SEGUIMIENTO_NAVIGATION_COORDINATOR, useValue: {
        withNextSequence<T>(operation: (sequence: number) => Promise<T>) { return operation(1); },
        withLock<T>(operation: () => Promise<T>) { return operation(); }
      } },
      { provide: ActivatedRoute, useValue: {} }] });
    http = TestBed.inject(HttpTestingController);
    spyOn(localStorage, 'getItem').and.returnValue('no-usar-token-del-browser');
    TestBed.inject(SeguimientoNavigationService).request(() => of(undefined)).subscribe();
    http.expectOne('/api/seguimiento-prospecto/iniciar').flush({ success: true, context: '00000000-0000-4000-8000-000000000001' });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  afterEach(() => http.verify());
  it('envía sólo enlace, sin prospectId ni Authorization', () => {
    TestBed.inject(ProspectoClienteService).obtenerProspecto('identidad-no-confiable', 'enlace-prueba').subscribe();
    const r = http.expectOne('/api/seguimiento-prospecto/prospecto');
    expect(r.request.method).toBe('POST');
    expect(r.request.params.keys()).toEqual([]);
    expect(r.request.body).toEqual({link: 'enlace-prueba'});
    expect(r.request.headers.get('X-Seguimiento-Context')).toBe('00000000-0000-4000-8000-000000000001');
    expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.withCredentials).toBeTrue();
    r.flush({success: true, accountResponse: {aliasUser: false}});
  });
  it('recarga consulta prospecto sin enlace ni query usando contexto y cookie', () => {
    TestBed.inject(ProspectoClienteService).obtenerProspecto('', '').subscribe();
    const r = http.expectOne('/api/seguimiento-prospecto/prospecto');
    expect(r.request.method).toBe('GET');
    expect(r.request.params.keys()).toEqual([]);
    expect(r.request.withCredentials).toBeTrue();
    r.flush({success:true, accountResponse:{}, smsValidated:true});
  });
  it('SMS sólo envía el código con cookie y protección CSRF', () => {
    TestBed.inject(ProspectoClienteService).validarTokenSms({tokenSms: '123456'}).subscribe();
    const r = http.expectOne('/api/seguimiento-prospecto/validar-sms');
    expect(r.request.body).toEqual({tokenSms: '123456'});expect(r.request.withCredentials).toBeTrue();
    expect(r.request.headers.get('X-Seguimiento-Context')).toBe('00000000-0000-4000-8000-000000000001');
    expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.headers.get('X-Portal-Request')).toBe('1');r.flush({success:true});
  });
  it('cuenta pública no recupera identidad por endpoints legacy al recibir 503', () => {
    const c = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    c.prospectId = 'no-usar';(c as any).tokenSmsValidado = true;c.consultarCuentaComercio();
    const r=http.expectOne('/api/seguimiento-prospecto/cuenta');expect(r.request.params.keys()).toEqual([]);
    expect(r.request.headers.has('Authorization')).toBeFalse();r.flush({success:false},{status:503,statusText:'Unavailable'});
    expect(c.errorLiquidacion).toContain('No fue posible consultar');
    expect(c.errorProspecto).toBe('');expect((c as any).tokenSmsValidado).toBeTrue();http.expectNone(req=>req.url.includes('account/get'));
  });
  it('acciones públicas pendientes no usan GUID ni bearer mediante rutas antiguas', () => {
    const c=TestBed.runInInjectionContext(()=>new RegistroProspectoClienteComponent());
    c.prospectId='untrusted';c.cuentaComercio={commerceGuid:'untrusted'};
    c.continuarLiquidacion();c.aceptarModalLiquidacion();c.finalizar();
    (c as any).consultarDocumentos('untrusted');(c as any).consultarLiquidacionNodo();(c as any).consultarArbolReal('untrusted');
    c.verDocumentoProspecto({s3Key:'private-key'} as any);
    expect(c.prospectoBearerToken).toBe('');expect(c.error).toBe('');
    expect(c.errorDocumentos).toContain('aún no están disponibles');http.expectNone(()=>true);
  });
});
