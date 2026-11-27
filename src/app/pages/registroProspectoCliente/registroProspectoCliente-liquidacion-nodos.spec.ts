import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Liquidación pública por nodo, independiente de accesos',()=>{
 let c:any, api:any, confirmed:Record<string,string>;
 beforeEach(()=>{
  api=jasmine.createSpyObj('Seguimiento',['consultarLiquidacionNodo','guardarLiquidacion','guardarDispersionEnRed','guardarAccesos','consultarDocumentos','finalizarLiquidacion']);
  TestBed.configureTestingModule({providers:[provideHttpClient(),{provide:ActivatedRoute,useValue:{}},{provide:SeguimientoProspectoService,useValue:api}]});
  c=TestBed.runInInjectionContext(()=>new RegistroProspectoClienteComponent());
  c.enlaceAutorizado=true;c.nodoSeleccionado='root';c.liquidacionConsultada=true;c.liquidacionRegistrada=true;
  c.arbol=[{id:'root',nombre:'Entidad',nivel:'entidad',levelType:4,hijos:[1,2,3].map(i=>({id:`s${i}`,nombre:`Sucursal ${i}`,nivel:'sucursal',levelType:5,hijos:[{id:`box${i}`,nivel:'caja',levelType:6},{id:`terminal${i}`,nivel:'terminal',levelType:7}]}))}];
  confirmed={root:'OTHER_BANK'};
  api.finalizarLiquidacion.and.returnValue(of({success:true,complete:true,idStatus:33}));
  api.consultarLiquidacionNodo.and.callFake((id:string)=>of({success:true,status:31,dispersionAccount:confirmed[id]||null,cuentaCLConfirmada:!!confirmed[id],hasPlatformAccess:false,permissions:{editLiquidation:true,editAccess:false}}));
  api.consultarDocumentos.and.returnValue(of({success:true,documents:[]}));
  spyOn(c,'consultarCuentaNodoPublico').and.callFake(()=>c.consultarLiquidacionNodo());
 });
 it('Entidad + 3 sucursales: guardar padre pasa a hija sin accesos y conserva permisos reales',async()=>{
  c.modalLiquidacion='guardada';c.aceptarModalLiquidacion();await Promise.resolve();await Promise.resolve();
  expect(c.nodoSeleccionado).toBe('s1');expect(c.liquidacionPublicaBloqueada).toBeFalse();expect(c.pasoActivo).toBe('liquidacion');
  expect(api.guardarAccesos).not.toHaveBeenCalled();expect(c.liquidacionPorNodo.root.registrada).toBeTrue();
 });
 it('Entidad + 1 sucursal + caja: omite cajas y permite guardar sucursal',async()=>{
  c.arbol[0].hijos=c.arbol[0].hijos.slice(0,1);
  await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('s1');expect(c.liquidacionPublicaBloqueada).toBeFalse();
  expect(api.consultarLiquidacionNodo.calls.allArgs().every((args:any[])=>!String(args[0]).includes('box'))).toBeTrue();
 });
 it('individual sucursal + caja: solo reconsulta estado final, no cambia estatus ni registra accesos',async()=>{
  c.arbol=[{id:'root',nombre:'Sucursal',nivel:'sucursal',levelType:5,hijos:[{id:'box',nivel:'caja',levelType:6}]}];
  await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('root');
  expect(api.consultarLiquidacionNodo.calls.allArgs()).toEqual([['root'],['root']]);expect(api.finalizarLiquidacion).toHaveBeenCalledOnceWith('root');expect(api.guardarAccesos).not.toHaveBeenCalled();
 });
 it('última sucursal visual vuelve a entidad pendiente; no usa nodoRegistroCompleto',async()=>{
  c.nodoSeleccionado='s3';confirmed={s3:'NETWORK'};
  spyOn(c,'nodoRegistroCompleto').and.throwError('No debe consultar accesos');
  await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('root');
 });
 it('recarga: recupera confirmadas de otros bancos y en red por GET, sin reenviar',async()=>{
  confirmed={root:'OTHER_BANK',s1:'NETWORK',s2:'OTHER_BANK_AND_NETWORK'};
  c.liquidacionPorNodo={};await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('s3');
  expect(api.guardarLiquidacion).not.toHaveBeenCalled();expect(api.guardarDispersionEnRed).not.toHaveBeenCalled();
 });
 it('mantiene bloqueo del BFF si la sucursal no tiene permiso, sin ignorarlo',async()=>{
  api.consultarLiquidacionNodo.and.returnValue(of({success:true,status:33,dispersionAccount:null,permissions:{editLiquidation:false,editAccess:false}}));
  await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('s1');expect(c.liquidacionPublicaBloqueada).toBeTrue();
 });
 it('no avanza tras guardado fallido ni consulta durante escritura en curso',async()=>{
  c.liquidacionRegistrada=false;await c.continuarSiguienteLiquidacion();expect(api.consultarLiquidacionNodo).not.toHaveBeenCalled();
  c.liquidacionRegistrada=true;c.guardandoLiquidacion=true;await c.continuarSiguienteLiquidacion();expect(api.consultarLiquidacionNodo).not.toHaveBeenCalled();
 });
 it('error al consultar no navega ni pierde la confirmación del nodo actual',async()=>{
  api.consultarLiquidacionNodo.and.returnValue(throwError(()=>({status:500})));
  await c.continuarSiguienteLiquidacion();expect(c.nodoSeleccionado).toBe('root');expect(c.liquidacionCompleta).toBeTrue();expect(c.buscandoLiquidacionPendiente).toBeFalse();
 });
 it('bloquea clics duplicados mientras consulta el siguiente nodo',async()=>{
  const pending=new Subject<any>();api.consultarLiquidacionNodo.and.returnValue(pending);
  const first=c.continuarSiguienteLiquidacion();await c.continuarSiguienteLiquidacion();expect(api.consultarLiquidacionNodo).toHaveBeenCalledTimes(1);
  pending.error({status:500});await first;
 });
 it('modo interno no utiliza navegación pública',async()=>{
  c.modoInterno=true;await c.continuarSiguienteLiquidacion();expect(api.consultarLiquidacionNodo).not.toHaveBeenCalled();
 });
});
