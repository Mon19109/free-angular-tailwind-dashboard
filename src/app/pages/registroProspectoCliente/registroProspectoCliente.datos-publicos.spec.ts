import { StepDatosComponent } from '../preRegistro/components/datos-generales/step-datos.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { StepAccesosComponent } from '../preRegistro/components/accesos/step-accesos.component';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ProspectoClienteService } from '../../services/prospecto-cliente.service';
import { SeguimientoNavigationService } from '../../services/seguimiento-navigation.service';
import { SeguimientoProspectoService } from '../../services/seguimiento-prospecto.service';
import { RegistroProspectoClienteComponent } from './registroProspectoCliente.component';

describe('Seguimiento: edición pública Datos Generales', () => {
  let c: RegistroProspectoClienteComponent;
  let api: jasmine.SpyObj<SeguimientoProspectoService>;
  let prospecto: jasmine.SpyObj<ProspectoClienteService>;
  let navigation: jasmine.SpyObj<SeguimientoNavigationService>;
  const root = '10000000-0000-4000-8000-000000000001';
  const child = '10000000-0000-4000-8000-000000000002';
  const document = { ref: '10000000-0000-4000-8000-000000000003', name: 'Constancia fiscal', documentType: 'CSF', status: 'APPROVED' };

  beforeEach(() => {
    api = jasmine.createSpyObj('seguimiento', ['actualizarDatosGenerales', 'consultarCuenta', 'consultarArbol', 'consultarLiquidacionNodo', 'consultarDocumentos', 'guardarDispersionEnRed', 'guardarLiquidacion', 'guardarAccesos', 'completar', 'renovarAcceso', 'subirDocumentoNodo']);
    prospecto = jasmine.createSpyObj('prospecto', ['obtenerProspecto']);
    navigation = jasmine.createSpyObj('navigation', ['restartForNavigation']);
    navigation.restartForNavigation.and.returnValue(of(undefined));
    prospecto.obtenerProspecto.and.returnValue(of({ success: true, accountResponse: {}, linkAuthorized: true }));
    api.consultarCuenta.and.returnValue(of({ success: true, entityInfo: {} }));
    api.consultarArbol.and.returnValue(of({ success: true, nodes: [
      { ref: root, name: 'Entidad', levelType: 4, depth: 0 },
      { ref: child, name: 'Sucursal', levelType: 5, depth: 1 }
    ] }));
    api.consultarLiquidacionNodo.and.returnValue(of({ success: true, status: 31, permissions: {editLiquidation:true,editAccess:true}, dispersionAccount: null, cuentaCLConfirmada: null, hasPlatformAccess: false }));
    api.subirDocumentoNodo.and.returnValue(of({success:true}));
    api.consultarDocumentos.and.returnValue(of({ success: true, documents: [document] }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: ActivatedRoute, useValue: {} },
      { provide: SeguimientoProspectoService, useValue: api }, { provide: ProspectoClienteService, useValue: prospecto },
      { provide: SeguimientoNavigationService, useValue: navigation }] });
    c = TestBed.runInInjectionContext(() => new RegistroProspectoClienteComponent());
    c.link = 'fixture-link';
    c.cargando = false;
    (c as any).enlaceAutorizado = true;
    spyOn(window, 'scrollTo');
  });

  const fields=['nombreComercial','razonSocial','rfc','nombre','actividad','giroComercial','descripcionGiro','mcc','nombreVialidad'];
  function cuenta(tipo='PF', nombre='Comercio original') {
    return {success:true,entityInfo:{typePerson:tipo,nameCommerce:nombre,businessName:'Razón real',rfc:'AAAA010101AAA',
      activityDescription:'Actividad real',businessLine:'Familia real',bussinesLineDescription:'Giro real',businessActivityCode:'5411',
      generalInformationEditFields:fields,commerceAddress:[{addressType:'DF',roadName:'Calle real'}]}};
  }
  for(const tipo of ['PF','PM']) it(`carga ${tipo}, actualiza una vez y confirma con GET del mismo nodo`,()=>{
    api.consultarCuenta.and.returnValue(of(cuenta(tipo)));c.consultarCuentaComercio();
    expect(c.puedeActualizarDatosGenerales).toBeTrue();expect(c.datosForm.controls.tipoPersona.value).toBe(tipo);
    expect(c.datosForm.controls.giroComercial.value).toBe('Familia real');
    expect(c.datosForm.controls.descripcionGiro.value).toBe('Giro real');
    expect(c.datosForm.controls.rfc.value).toBe('AAAA010101AAA');
    const pending=new Subject<any>();api.actualizarDatosGenerales.and.returnValue(pending);
    const fixture = TestBed.createComponent(StepDatosComponent);
    fixture.componentInstance.form=c.datosForm;fixture.componentInstance.campos=c.camposDatosGenerales;
    fixture.componentInstance.preregistroPublico=true;fixture.componentInstance.mostrarCodigosGiro=true;
    fixture.componentInstance.validarSoloCambios=true;fixture.componentInstance.textoContinuar='Actualizar';
    fixture.componentInstance.continuar.subscribe(()=>c.actualizarDatosGenerales());fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(tipo==='PF'?'#actividad':'#descripcionGiro')).not.toBeNull();
    const input=fixture.nativeElement.querySelector('#nombreComercial') as HTMLInputElement;
    input.value='Comercio editado';input.dispatchEvent(new Event('input'));
    const button=fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.textContent).toContain('Actualizar');button.click();c.actualizarDatosGenerales();
    expect(api.actualizarDatosGenerales).toHaveBeenCalledOnceWith(root,{nombreComercial:'Comercio editado'});
    expect(c.mensajeDatosGenerales).not.toContain('correctamente');
    api.consultarCuenta.and.returnValue(of(cuenta(tipo,'Comercio editado')));
    pending.next({success:true});pending.complete();
    expect(api.consultarCuenta.calls.mostRecent().args).toEqual([root]);
    expect(c.mensajeDatosGenerales).toBe('Se actualizó correctamente.');
    expect(c.guardandoDatosGenerales).toBeFalse();
    expect(c.datosForm.controls.nombreVialidad.value).toBe('Calle real');
    expect(c.datosForm.controls.rfc.value).toBe('AAAA010101AAA');
    fixture.destroy();
  });
  it('conserva captura ante error y permite reintento sin mostrar error privado',()=>{
    api.consultarCuenta.and.returnValue(of(cuenta()));c.consultarCuentaComercio();
    api.actualizarDatosGenerales.and.returnValue(throwError(()=>({status:502,error:{message:'private-token'}})));
    c.datosForm.controls.nombreComercial.setValue('Pendiente');c.actualizarDatosGenerales();
    expect(c.datosForm.controls.nombreComercial.value).toBe('Pendiente');expect(c.guardandoDatosGenerales).toBeFalse();
    expect(c.mensajeDatosGenerales).not.toContain('private-token');expect(c.mensajeDatosGenerales).not.toContain('correctamente');
    c.actualizarDatosGenerales();expect(api.actualizarDatosGenerales).toHaveBeenCalledTimes(2);
  });
  it('GET sin persistencia no confirma éxito ni borra la captura',()=>{
    api.consultarCuenta.and.returnValue(of(cuenta()));c.consultarCuentaComercio();
    api.actualizarDatosGenerales.and.returnValue(of({success:true}));
    c.datosForm.controls.nombreComercial.setValue('Pendiente');c.actualizarDatosGenerales();
    expect(c.datosForm.controls.nombreComercial.value).toBe('Pendiente');expect(c.mensajeDatosGenerales).toContain('No fue posible confirmar');
    c.actualizarDatosGenerales();expect(api.actualizarDatosGenerales).toHaveBeenCalledTimes(2);
  });
  it('campos obligatorios modificados vacíos y enlaces no autorizados no escriben',()=>{
    api.consultarCuenta.and.returnValue(of(cuenta()));c.consultarCuentaComercio();
    c.datosForm.controls.nombreComercial.setValue('');c.actualizarDatosGenerales();
    expect(api.actualizarDatosGenerales).not.toHaveBeenCalled();expect(c.datosForm.controls.nombreComercial.touched).toBeTrue();
    c.datosForm.controls.nombreComercial.setValue('Nuevo');(c as any).enlaceAutorizado=false;c.actualizarDatosGenerales();
    expect(api.actualizarDatosGenerales).not.toHaveBeenCalled();
  });
  it('seleccionar colonia conserva el mapeo de Preregistro y el resto de la captura',()=>{
    api.consultarCuenta.and.returnValue(of(cuenta()));c.consultarCuentaComercio();
    c.localidadesDatos['DF']=[{idLocalidad:'42',colonia:'Colonia real',municipio:'Municipio real',estado:'Estado real'}];
    c.seleccionarLocalidadDatos('42','DF');
    expect(c.datosForm.controls.colonia.value).toBe('Colonia real');
    expect(c.datosForm.controls.localidad.value).toBe('Colonia real');
    expect(c.datosForm.controls.locationID.value).toBe('42');
    expect(c.datosForm.controls.rfc.value).toBe('AAAA010101AAA');
  });

});
