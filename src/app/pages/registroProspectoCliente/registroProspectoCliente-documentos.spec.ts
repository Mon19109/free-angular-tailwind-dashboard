import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Seguimiento: carga y continuación documental',()=>{
 let c:any, api:any;
 const event={archivo:new File(['%PDF-123'], 'archivo.pdf',{type:'application/pdf'}),documento:{numero:1,nombre:'Prueba',obligatorio:false}};
 beforeEach(()=>{
  api=jasmine.createSpyObj('Seguimiento',['subirDocumentoNodo','consultarDocumentos']);
  api.consultarDocumentos.and.returnValue(of({success:true,documents:[]}));
  TestBed.configureTestingModule({providers:[provideHttpClient(),{provide:ActivatedRoute,useValue:{}},{provide:SeguimientoProspectoService,useValue:api}]});
  c=TestBed.runInInjectionContext(()=>new RegistroProspectoClienteComponent());
  c.enlaceAutorizado=true;c.nodoSeleccionado='s1';
  c.arbol=[{id:'s1',nombre:'Uno',nivel:'sucursal',levelType:5,hijos:[{id:'caja',nivel:'caja',levelType:6}]},{id:'s2',nombre:'Dos',nivel:'sucursal',levelType:5},{id:'s3',nombre:'Tres',nivel:'sucursal',levelType:5}];
 });
 it('muestra carga inmediata, evita duplicados y refresca el estado real sin aprobar',async()=>{
  const pending=new Subject<any>();api.subirDocumentoNodo.and.returnValue(pending);
  api.consultarDocumentos.and.returnValue(of({success:true,documents:[{ref:'doc',name:'archivo.pdf',status:'IN_REVIEW'}]}));
  const upload=c.subirDocumentoPublico(event);expect(c.subiendoDocumentoPublico).toBeTrue();
  await c.subirDocumentoPublico(event);await upload;
  expect(api.subirDocumentoNodo).toHaveBeenCalledTimes(1);
  pending.next({success:true});pending.complete();
  expect(c.subiendoDocumentoPublico).toBeFalse();expect(c.modalDocumentoPublico).toBe('exito');
  expect(c.documentosProspecto[0].status).toBe('IN_REVIEW');
 });
 for(const tipo of ['http','negocio','excepcion']) it(`cierra carga y muestra error: ${tipo}`,async()=>{
  if(tipo==='excepcion') api.subirDocumentoNodo.and.callFake(()=>{throw new Error('Error');});
  else api.subirDocumentoNodo.and.returnValue(tipo==='http'?throwError(()=>({status:500})):of({success:false}));
  await c.subirDocumentoPublico(event);
  expect(c.subiendoDocumentoPublico).toBeFalse();expect(c.modalDocumentoPublico).toBe('error');
 });
 it('avanza en orden al pendiente, omite cajas y aprobados y no sube archivos',async()=>{
  api.consultarDocumentos.and.callFake((id:string)=>of({success:true,documents:id==='s2'?[{status:'APPROVED'}]:[{status:'REJECTED'}]}));
  const select=spyOn(c,'seleccionarNodo');
  await c.continuarDocumentosPublicos();
  expect(api.consultarDocumentos.calls.allArgs()).toEqual([['s2'],['s3']]);
  expect(select).toHaveBeenCalledOnceWith('s3');expect(c.seccionInformativaAbierta).toBe('documentos');
  expect(api.subirDocumentoNodo).not.toHaveBeenCalled();
 });
 it('bloquea navegación durante carga y conserva paso y estatus al terminar',async()=>{
  const select=spyOn(c,'seleccionarNodo'); c.subiendoDocumentoPublico=true;
  await c.continuarDocumentosPublicos();expect(api.consultarDocumentos).not.toHaveBeenCalled();
  c.subiendoDocumentoPublico=false;c.estatusPublico=33;c.pasoActivo='liquidacion';
  api.consultarDocumentos.and.returnValue(of({success:true,documents:[{status:'APPROVED'}]}));
  await c.continuarDocumentosPublicos();expect(select).not.toHaveBeenCalled();
  expect(c.estatusPublico).toBe(33);expect(c.pasoActivo).toBe('liquidacion');
 });
 it('no navega si falla la consulta',async()=>{
  api.consultarDocumentos.and.returnValue(throwError(()=>({status:500})));
  const select=spyOn(c,'seleccionarNodo');await c.continuarDocumentosPublicos();
  expect(select).not.toHaveBeenCalled();expect(c.buscandoNodoDocumental).toBeFalse();expect(c.modalDocumentoPublico).toBe('error');
 });
 it('selecciona realmente el siguiente nodo y carga su tabla mediante el flujo existente',async()=>{
  spyOn(c,'consultarCuentaNodoPublico');
  api.consultarDocumentos.and.returnValue(of({success:true,documents:[{ref:'doc2',name:'Dos.pdf',status:'IN_REVIEW'}]}));
  await c.continuarDocumentosPublicos();
  expect(c.nodoSeleccionado).toBe('s2');
  expect(c.documentosProspecto[0].id).toBe('doc2');
  expect(c.documentosProspecto[0].status).toBe('IN_REVIEW');
  expect(c.seccionInformativaAbierta).toBe('documentos');
  expect(api.subirDocumentoNodo).not.toHaveBeenCalled();
 });

 it('cierra el resultado y limpia su mensaje con el mecanismo del popup existente',()=>{
  for (const estado of ['exito','error']) {
   c.modalDocumentoPublico=estado;c.mensajeDocumentoPublico='Mensaje';
   c.cerrarModalDocumentoPublico();
   expect(c.modalDocumentoPublico).toBeNull();expect(c.mensajeDocumentoPublico).toBe('');
  }
 });

});
