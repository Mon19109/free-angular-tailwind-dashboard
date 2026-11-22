import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { DatosGeneralesAdminComponent } from './components/datos-generales-admin/datos-generales-admin.component';
import { StepDatosComponent } from '../preRegistro/components/datos-generales/step-datos.component';
import { ActividadesService } from '../../services/actividades.service';
import { PreRegistroService } from '../../services/preregistro.service';
import { SessionRefreshService } from '../../services/session-refresh.service';
import { AuthService } from '../../services/auth.service';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { RegistroClienteComponent } from './registroCliente.component';

const ref = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const response = (selected = ref) => ({ success: true, commerce: { ref: selected, nameCommerce: 'Comercio real',
  businessName: 'Razón real', rfc: 'RFC', email: 'fixture@example.test', phoneNumber: '123', status: 'ACTIVO', nivel: 'Entidad' },
  navigation: { path: '/registro_cliente', actionLabel: 'Editar Comercio' }, capabilities: {} });

describe('Editar comercio: actividad y giro', () => {
  let params: BehaviorSubject<any>;
  let http: HttpTestingController;
  let component: RegistroClienteComponent;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ ref, nodeID: 'ignorar', commerceID: 'ignorar' }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }
    ] });
    http = TestBed.inject(HttpTestingController);
    spyOn(localStorage, 'getItem').and.throwError('No leer storage');
    component = TestBed.runInInjectionContext(() => new RegistroClienteComponent());
  });
  afterEach(() => {
    for (const request of http.match(req => /\/(pld|documentos)$/.test(req.url))) {
      if (!request.cancelled) request.flush({}, { status: 503, statusText: 'Unavailable' });
    }
    http.verify();
  });
  for (const tipo of ['PF', 'PM']) it(`busca, conserva datos y confirma persistencia ${tipo}`, () => {
    TestBed.inject(AuthService).actualizarSesion({success:true,authenticated:true,expiresAt:Date.now()+60000,usuario:{idRol:2}});
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({...response(),capabilities:{tree:true}});
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({success:true,tree:[{ref,name:'Entidad',levelType:4,depth:0}]});
    const info = {nameCommerce:'Original', businessName:'Razón original', rfc:'RFC ORIGINAL',personType:tipo,
      idActivity:'1',activityDescription:'Actividad anterior',idBussinesLine:'2',businessLine:'Familia anterior',
      bussinesLineDescription:'Giro anterior',businessActivityCode:'1111',commerceAddress:[{addressType:'DF',roadName:'Calle original'}]};
    const result = (information: any) => ({success:true,information,permissions:{editInformation:true,
      editFields:['actividad','actividadId','giroId','giroComercial','descripcionGiro','mcc']}});
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush(result(info));
    const popup=spyOn(component as any,'mostrarModalRegistro');
    const before=component.datosForm.getRawValue();
    component.guardarDatosNodo();
    http.expectNone(r=>r.method==='PUT');
    expect(component.datosForm.getRawValue()).toEqual(before);
    const fixture=TestBed.createComponent(DatosGeneralesAdminComponent);
    fixture.componentInstance.form=component.datosForm;
    fixture.componentInstance.campos=['actividad','giroComercial','descripcionGiro','mcc'];
    fixture.componentInstance.permitirActividad=true;fixture.componentInstance.permitirGiro=true;
    fixture.detectChanges();
    const buscador=fixture.debugElement.query(By.directive(StepDatosComponent)).componentInstance as StepDatosComponent;
    spyOn(TestBed.inject(ActividadesService),'getActividades').and.returnValue(of([{idActivity:42,descripcion:'Actividad nueva'}]) as any);
    spyOn(TestBed.inject(PreRegistroService),'getGirosByFamily').and.returnValue(of([{idBussinesLine:75,familia:'Familia nueva',descripcion:'Giro nuevo',mcc:'5411'}]) as any);
    const button=Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const search=button.find(b=>b.textContent?.includes(tipo==='PF'?'Buscar Actividad':'SELECCIONA AQUÍ'))!;
    expect(search).toBeDefined();search.click();fixture.detectChanges();
    expect(component.datosForm.getRawValue()).toEqual(before);
    if(tipo==='PF') {
      buscador.terminoActividad.setValue('nueva');
      buscador.seleccionarActividadModal(buscador.actividadesFiltradas[0]);buscador.guardarActividadModal();
    } else {
      buscador.buscarGirosComerciales('Familia');
      buscador.seleccionarGiroModal(buscador.girosBusqueda[0]);buscador.guardarGiroModal();
    }
    expect(component.datosForm.controls.rfc.value).toBe(before.rfc);
    expect(component.datosForm.controls.nombreVialidad.value).toBe(before.nombreVialidad);
    expect(component.datosForm.controls.razonSocial.value).toBe(before.razonSocial);
    expect(component.datosForm.controls.tipoPersona.value).toBe(before.tipoPersona);
    component.guardarDatosNodo();
    const put=http.expectOne(r=>r.method==='PUT');
    const expected=tipo==='PF'?{actividad:'Actividad nueva',actividadId:'42'}:
      {giroId:'75',giroComercial:'Familia nueva',descripcionGiro:'Giro nuevo',mcc:'5411'};
    expect(put.request.body).toEqual({cambios:expected});put.flush({success:true});
    expect(popup).not.toHaveBeenCalled();
    http.expectOne(`/api/comercios/${ref}/nodos/${ref}/informacion-general`).flush(result({...info,
      ...(tipo==='PF'?{idActivity:'42',activityDescription:'Actividad nueva'}:
        {idBussinesLine:'75',businessLine:'Familia nueva',bussinesLineDescription:'Giro nuevo',businessActivityCode:'5411'})}));
    expect(popup).toHaveBeenCalled();expect(component.hayCambiosNoConfirmados).toBeFalse();
    fixture.destroy();
  });
});
