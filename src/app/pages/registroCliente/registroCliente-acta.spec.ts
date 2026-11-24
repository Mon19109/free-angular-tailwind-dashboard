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
 it('MD: guardar revisión confirma estados antes de mostrar Continuar y no cambia estatus',()=>{
  (c as any).actaStatus=35;spyOnProperty(c,'puedeRevisarDocumentosBff','get').and.returnValue(true);
  spyOn<any>(c,'refrescarEstadoDocumentalBff');spyOn<any>(c,'mostrarModalRegistro');
  c.documentosProspecto=[{ref:'doc-ref',status:'APPROVED'} as any];
  const next='22222222-2222-4222-8222-222222222222';
  const progress={rootStatus:35,selectedApproved:true,nextRef:next,canRegister:false,nodes:[{ref,name:'Entidad',pending:[]},{ref:next,name:'Sucursal',pending:[10]}]};
  expect(c.accionRevisionMD).toBeNull();c.guardarRevisionDocumentos();
  const req=http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos/revision`);
  expect(c.accionRevisionMD).toBeNull();req.flush({success:true,reviewProgress:progress});
  expect(c.accionRevisionMD).toBe('Continuar');c.progresoMD!.selectedApproved=false;expect(c.accionRevisionMD).toBe('Continuar');expect(c.pendientesRevisionMD).toContain('Sucursal: documentos 10');
  c.arbolServicio=[{id:ref,nombre:'Entidad',nivel:'entidad',hijos:[{id:'caja',nombre:'Caja',nivel:'caja'},{id:next,nombre:'Sucursal',nivel:'sucursal'}]} as any];
  const select=spyOn(c,'seleccionarNodo');c.continuarRevisionMD();expect(select.calls.mostRecent().args[0].id).toBe(next);
  http.expectNone(r=>r.url.endsWith('/registrar'));
 });
 it('MD: último nodo solo muestra Registrar con todos los obligatorios confirmados y refresca tras GET confirmado del BFF',()=>{
  (c as any).actaStatus=35;(c as any).revisionesMDGuardadas.add(`${ref}:${ref}`);
  c.progresoMD={rootStatus:35,selectedApproved:true,nextRef:null,canRegister:true,nodes:[{ref,name:'Último',pending:[]}]};
  const refresh=spyOn<any>(c,'refrescarEstadoDocumentalBff'),modal=spyOn<any>(c,'mostrarModalRegistro');
  expect(c.accionRevisionMD).toBe('Registrar');c.continuarRevisionMD();c.continuarRevisionMD();
  const req=http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos/registrar`);expect(req.request.body).toEqual({});
  expect(modal).not.toHaveBeenCalled();req.flush({success:true,idStatus:31});
  expect(modal.calls.mostRecent().args[0]).toBe('success');expect(refresh).toHaveBeenCalled();expect(c.accionRevisionMD).toBeNull();
 });
 it('MD: pendientes, errores y estados diferentes no muestran Registrar ni éxito',()=>{
  (c as any).actaStatus=35;(c as any).revisionesMDGuardadas.add(`${ref}:${ref}`);
  c.progresoMD={rootStatus:35,selectedApproved:false,nextRef:null,canRegister:false,nodes:[{ref,name:'Sucursal',pending:[1]}]};
  expect(c.accionRevisionMD).toBeNull();
  c.progresoMD={...c.progresoMD,selectedApproved:true,canRegister:true};
  const modal=spyOn<any>(c,'mostrarModalRegistro');spyOn<any>(c,'refrescarEstadoDocumentalBff');
  c.continuarRevisionMD();http.expectOne(`/api/comercios/${ref}/nodos/${ref}/documentos/registrar`).flush({}, {status:502,statusText:'Provider error'});
  expect(modal.calls.mostRecent().args[0]).toBe('error');
  for(const status of [25,30,31]){(c as any).actaStatus=status;expect(c.accionRevisionMD).toBeNull();}
 });

 it('MD: botones visuales conservan notificaciones y muestran únicamente la acción confirmada',()=>{
  const fixture=TestBed.createComponent(StepDocumentosComponent),step=fixture.componentInstance;
  step.mostrarMesaDigital=true;step.flujoRevisionMD=true;fixture.detectChanges();
  const labels=()=>Array.from(fixture.nativeElement.querySelectorAll('button')).map((b:any)=>b.textContent.trim());
  expect(labels()).toContain('Guardar revisión');expect(labels()).toContain('Enviar Notificación');
  expect(labels()).not.toContain('Continuar');expect(labels()).not.toContain('Registrar');
  step.accionRevisionMD='Continuar';fixture.detectChanges();expect(labels()).toContain('Continuar');
  step.accionRevisionMD='Registrar';fixture.detectChanges();expect(labels()).toContain('Registrar');expect(labels()).not.toContain('Continuar');
  step.flujoRevisionMD=false;fixture.detectChanges();expect(labels()).not.toContain('Registrar');fixture.destroy();
 });

});
