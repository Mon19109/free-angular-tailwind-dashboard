import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProspectoClienteService } from './prospecto-cliente.service';
import { authTokenInterceptor } from './auth-token.interceptor';
import { ActivatedRoute } from '@angular/router';
import { RegistroProspectoClienteComponent } from '../pages/registroProspectoCliente/registroProspectoCliente.component';

describe('Seguimiento público: transporte y límites de autorización', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: {} }] });
    http = TestBed.inject(HttpTestingController);
    spyOn(localStorage, 'getItem').and.returnValue('no-usar-token-del-browser');
  });
  afterEach(() => http.verify());
  it('envía sólo enlace, sin prospectId ni Authorization', () => {
    TestBed.inject(ProspectoClienteService).obtenerProspecto('identidad-no-confiable', 'enlace-prueba').subscribe();
    const r = http.expectOne('/api/seguimiento-prospecto/prospecto?link=enlace-prueba');
    expect(r.request.params.keys()).toEqual(['link']);
    expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.withCredentials).toBeTrue();
    r.flush({success: true, accountResponse: {aliasUser: false}});
  });
  it('SMS sólo envía el código con cookie y protección CSRF', () => {
    TestBed.inject(ProspectoClienteService).validarTokenSms({tokenSms: '123456'}).subscribe();
    const r = http.expectOne('/api/seguimiento-prospecto/validar-sms');
    expect(r.request.body).toEqual({tokenSms: '123456'});expect(r.request.withCredentials).toBeTrue();
    expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.headers.get('X-Portal-Request')).toBe('1');r.flush({success:true});
  });
  it('cuenta pública no recupera identidad por endpoints legacy al recibir 503', () => {
    const c = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    c.prospectId = 'no-usar';c.consultarCuentaComercio();
    const r=http.expectOne('/api/seguimiento-prospecto/cuenta');expect(r.request.params.keys()).toEqual([]);
    expect(r.request.headers.has('Authorization')).toBeFalse();r.flush({success:false},{status:503,statusText:'Unavailable'});
    expect(c.errorProspecto).toContain('no está disponible');http.expectNone(req=>req.url.includes('account/get'));
  });
  it('acciones públicas pendientes no usan GUID ni bearer mediante rutas antiguas', () => {
    const c=TestBed.runInInjectionContext(()=>new RegistroProspectoClienteComponent());
    c.prospectId='untrusted';c.cuentaComercio={commerceGuid:'untrusted'};
    c.continuarLiquidacion();c.aceptarModalLiquidacion();c.finalizar();
    (c as any).consultarDocumentos('untrusted');(c as any).consultarLiquidacionNodo();(c as any).consultarArbolReal('untrusted');
    c.verDocumentoProspecto({s3Key:'private-key'} as any);
    expect(c.prospectoBearerToken).toBe('');expect(c.error).toContain('autorización');http.expectNone(()=>true);
  });
});
