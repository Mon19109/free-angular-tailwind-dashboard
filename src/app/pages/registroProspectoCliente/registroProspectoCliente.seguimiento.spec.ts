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

describe('Seguimiento: acceso directo por enlace y estado real',()=>{
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
  function load(linkAuthorized:boolean,status:string){
    (c as any).cargarProspecto();
    http.expectOne('/api/seguimiento-prospecto/prospecto').flush({success:true,accountResponse:{aliasUser:false},linkAuthorized,registration:{status}});
  }
  it('abre y recarga directamente sin formulario ni peticiones SMS',()=>{
    load(true,'PARTIAL'); expect(c.enlaceAutorizado).toBeTrue();
    expect(c.registroFinalizado).toBeFalse(); expect(c.consultarCuentaComercio).toHaveBeenCalledTimes(1);
    load(true,'PARTIAL'); expect(c.consultarCuentaComercio).toHaveBeenCalledTimes(2);
    http.expectNone(r=>/sms/i.test(r.url));
  });
  it('un enlace no autorizado no permite consultar la cuenta',()=>{
    load(false,'PARTIAL'); expect(c.enlaceAutorizado).toBeFalse();
    expect(c.consultarCuentaComercio).not.toHaveBeenCalled(); http.expectNone(()=>true);
  });
  it('registro completo no permite nuevas escrituras',()=>{
    load(false,'COMPLETED'); expect(c.registroFinalizado).toBeTrue();
    c.continuarLiquidacion(); c.aceptarModalLiquidacion(); c.finalizar(); http.expectNone(()=>true);
  });
  it('accesos usa referencia y datos del formulario, nunca Sirio/perfil/token',()=>{
    const users=[{kind:'admin',name:'Prueba',paternalSurname:'Prueba',maternalSurname:'Prueba',email:'prueba@example.invalid',phoneNumber:'5512345678'}];
    TestBed.inject(SeguimientoProspectoService).guardarAccesos('opaque-reference',users).subscribe();
    const r=http.expectOne('/api/seguimiento-prospecto/nodos/opaque-reference/accesos');
    expect(r.request.body).toEqual({users});expect(r.request.headers.has('Authorization')).toBeFalse();expect(r.request.withCredentials).toBeTrue();expect(r.request.headers.get('X-Portal-Request')).toBe('1');r.flush({success:true});
  });
  for (const estado of ['actualizado', 'incompleto', 'pendiente']) it(`carga documental ${estado}: refresca cuenta solo con transición confirmada`, async()=>{
    c.enlaceAutorizado=true;c.nodoSeleccionado='opaque-node';
    spyOnProperty(c,'permiteCargaPublica','get').and.returnValue(true);
    spyOnProperty(c,'documentosCargaPublica','get').and.returnValue([{numero:1,nombre:'Documento',obligatorio:true}] as any);
    const cuenta=spyOn<any>(c,'consultarCuentaNodoPublico');
    const documentos=spyOn<any>(c,'consultarDocumentos');
    const archivo=new File(['%PDF-1.7 fixture'],'documento.pdf',{type:'application/pdf'});
    await c.subirDocumentoPublico({archivo,documento:{numero:1} as any});
    const request=http.expectOne('/api/seguimiento-prospecto/nodos/opaque-node/documentos');
    expect(request.request.body.get('numeroDocumento')).toBe('1');
    expect(request.request.body.has('commerceGuid')).toBeFalse();
    expect(request.request.body.has('idStatus')).toBeFalse();
    request.flush({success:true,documentacion:{estado,...(estado==='actualizado'?{idStatus:30}:{})}});
    expect(documentos).toHaveBeenCalledTimes(1);
    expect(cuenta.calls.count()).toBe(estado==='actualizado'?1:0);
    http.expectNone(r=>r.method==='PUT');
  });

});
