import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { RegistroClienteComponent } from './registroCliente.component';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';
const ref='11111111-1111-4111-8111-111111111111';
describe('Acta Constitutiva interna',()=>{
 let c:RegistroClienteComponent, http:HttpTestingController;
 beforeEach(()=>{
  const params=new BehaviorSubject(convertToParamMap({ref}));
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:params.value},queryParamMap:params}}]});
  http=TestBed.inject(HttpTestingController);
  c=TestBed.runInInjectionContext(()=>new RegistroClienteComponent());
  http.expectOne(`/api/comercios/${ref}/contexto`).flush({success:true,commerce:{ref,status:'30',nameCommerce:'Comercio'},navigation:{},capabilities:{}});
  c.nodoSeleccionado=ref;
  Object.assign(c,{actaNodo:`${ref}:${ref}`,actaStatus:30,actaPermitida:true});
 });
 afterEach(()=>{for(const req of http.match(()=>true))if(!req.cancelled)req.flush({}, {status:503,statusText:'Unavailable'});http.verify();});
 it('solo muestra estatus real 30 y nunca otro nodo o flujo',()=>{
  const fixture=TestBed.createComponent(StepDocumentosComponent);
  fixture.componentInstance.mostrarMesaDigital=true;
  for(const status of [25,30,35,31,null]){
   (c as any).actaStatus=status;fixture.componentInstance.mostrarActaConstitutiva=c.mostrarActaConstitutiva;fixture.detectChanges();
   expect(!!fixture.nativeElement.querySelector('#informacion-acta')).toBe(status===30);
  }
  (c as any).actaStatus=30;c.nodoSeleccionado='otro';expect(c.mostrarActaConstitutiva).toBeFalse();
  fixture.componentInstance.mostrarActaConstitutiva=true;fixture.componentInstance.cargaPublica=true;fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('#informacion-acta')).toBeNull();fixture.destroy();
 });
 it('no envía texto ni GUID, bloquea doble clic y refresca tras éxito confirmado',()=>{
  c.textoActa='Texto únicamente local';
  const modal=spyOn<any>(c,'mostrarModalRegistro');const refresh=spyOn<any>(c,'refrescarEstadoDocumentalBff');
  c.guardarInformacionActa();c.guardarInformacionActa();
  const request=http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos/acta-constitutiva`);
  expect(request.request.method).toBe('PUT');expect(request.request.body).toEqual({});
  expect(request.request.withCredentials).toBeTrue();expect(request.request.headers.get('X-Portal-Request')).toBe('1');
  expect(modal).not.toHaveBeenCalled();request.flush({success:true,idStatus:35});
  expect(c.mostrarActaConstitutiva).toBeFalse();expect(c.guardandoActa).toBeFalse();expect(refresh).toHaveBeenCalledTimes(1);
  expect(modal.calls.mostRecent().args[0]).toBe('success');expect(c.textoActa).toBe('Texto únicamente local');
 });
 it('texto vacío no bloquea y fallo de Payara no muestra éxito',()=>{
  const modal=spyOn<any>(c,'mostrarModalRegistro');spyOn<any>(c,'refrescarEstadoDocumentalBff');
  c.guardarInformacionActa();
  http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos/acta-constitutiva`).flush({}, {status:502,statusText:'Provider error'});
  expect(modal.calls.mostRecent().args[0]).toBe('error');expect(c.guardandoActa).toBeFalse();expect(c.mostrarActaConstitutiva).toBeTrue();
 });
});
