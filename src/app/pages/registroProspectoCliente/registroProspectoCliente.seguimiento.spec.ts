import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';
import { authTokenInterceptor } from '../../services/auth-token.interceptor';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import {
  SEGUIMIENTO_NAVIGATION_COORDINATOR,
  SEGUIMIENTO_NAVIGATION_TYPE,
  SeguimientoNavigationService
} from '../../services/seguimiento-navigation.service';
import { of } from 'rxjs';

describe('Seguimiento: recuperación de SMS y estado real',()=>{
  let c: RegistroProspectoClienteComponent, http: HttpTestingController;
  beforeEach(async ()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([authTokenInterceptor])),provideHttpClientTesting(),
      {provide:ActivatedRoute,useValue:{}},{provide:SEGUIMIENTO_NAVIGATION_TYPE,useValue:'navigate'},
      {provide:SEGUIMIENTO_NAVIGATION_COORDINATOR,useValue:{
        withNextSequence<T>(operation:(sequence:number)=>Promise<T>){return operation(1);},
        withLock<T>(operation:()=>Promise<T>){return operation();}
      }}]});
    c=TestBed.runInInjectionContext(()=>new RegistroProspectoClienteComponent());c.link='fixture-link';
    http=TestBed.inject(HttpTestingController);
    TestBed.inject(SeguimientoNavigationService).request(() => of(undefined)).subscribe();
    http.expectOne('/api/seguimiento-prospecto/iniciar').flush({success:true,context:'00000000-0000-4000-8000-000000000001'});
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    spyOn(c,'consultarCuentaComercio');
  });
  afterEach(()=>http.verify());
  function load(smsValidated:boolean,status:string){
    (c as any).cargarProspecto();
    http.expectOne('/api/seguimiento-prospecto/prospecto').flush({success:true,accountResponse:{aliasUser:false},smsValidated,registration:{status}});
  }
  it('refrescar una sesión validada no vuelve a validar SMS y conserva la etapa pendiente',()=>{
    load(true,'PARTIAL');expect(c.showTokenModal).toBeFalse();expect(c.registroFinalizado).toBeFalse();expect(c.consultarCuentaComercio).toHaveBeenCalledTimes(1);
    c.tokenValue='123456';c.validarTokenSms();http.expectNone(r=>r.url.includes('validar-sms'));
    load(true,'PARTIAL');expect(c.showTokenModal).toBeFalse();
  });
  it('una sesión nueva exige SMS aunque la liquidación esté configurada',()=>{
    load(false,'PARTIAL');expect(c.showTokenModal).toBeTrue();expect(c.registroFinalizado).toBeFalse();expect(c.consultarCuentaComercio).not.toHaveBeenCalled();
  });
  it('registro completo se muestra sin SMS ni nuevas escrituras',()=>{
    load(false,'COMPLETED');expect(c.registroFinalizado).toBeTrue();expect(c.showTokenModal).toBeFalse();
    c.validarTokenSms();c.continuarLiquidacion();c.aceptarModalLiquidacion();c.finalizar();http.expectNone(()=>true);
  });
  it('accesos usa referencia y datos del formulario, nunca Sirio/perfil/token',()=>{
    const users=[{kind:'admin',name:'Prueba',paternalSurname:'Prueba',maternalSurname:'Prueba',email:'prueba@example.invalid',phoneNumber:'5512345678'}];
    TestBed.inject(SeguimientoProspectoService).guardarAccesos('opaque-reference',users).subscribe();
    const r=http.expectOne('/api/seguimiento-prospecto/nodos/opaque-reference/accesos');
    expect(r.request.body).toEqual({users});expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.withCredentials).toBeTrue();expect(r.request.headers.get('X-Portal-Request')).toBe('1');r.flush({success:true});
  });
});
