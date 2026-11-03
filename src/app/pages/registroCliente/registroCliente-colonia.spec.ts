import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { RegistroClienteComponent } from './registroCliente.component';

const ref = '11111111-1111-4111-8111-111111111111';
const branch = '22222222-2222-4222-8222-222222222222';
const accountUrl = (node = ref) => `/api/comercios/${ref}/nodos/${node}/informacion-general`;
const information = (district?: string) => ({ success: true, information: {
  nameCommerce: 'Comercio de prueba', personType: 'PM', tipoComercio: 'Sucursales Únicas',
  contacts: [{ type: 1, address: { street: 'Calle', exteriorNumber: '2', postalCode: '56617',
    district, municipality: 'Valle de Chalco Solidaridad', state: 'México' } }]
} });

describe('Colonia del representante en Consulta de Comercios BFF', () => {
  let fixture: ComponentFixture<RegistroClienteComponent>;
  let component: RegistroClienteComponent;
  let http: HttpTestingController;
  const visibleInput = () => fixture.nativeElement.querySelector('#coloniaRepresentante') as HTMLInputElement;
  const visibleSelect = () => fixture.nativeElement.querySelector('app-select[formControlName="coloniaRepresentante"] select') as HTMLSelectElement;

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({ ref }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }
    ] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegistroClienteComponent);
    component = fixture.componentInstance;
    http.expectOne(`/api/comercios/${ref}/contexto`).flush({ success: true,
      commerce: { ref, nameCommerce: 'Comercio de prueba', nivel: 'Entidad' }, capabilities: { tree: true } });
    http.expectOne(`/api/comercios/${ref}/arbol`).flush({ success: true, tree: [
      { ref, name: 'Entidad', levelType: 4, depth: 0 },
      { ref: branch, name: 'Sucursal', levelType: 5, depth: 1 }
    ] });
    component.seccionAbierta = 'datos';
  });
  afterEach(() => {
    for (const req of http.match(request => /\/(pld|documentos)$/.test(request.url))) {
      if (!req.cancelled) req.flush({}, { status: 503, statusText: 'Unavailable' });
    }
    http.verify();
  });

  it('muestra district sin catálogo ni IDs y conserva los demás campos y permisos', () => {
    const req = http.expectOne(accountUrl());
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(information('Independencia'));
    fixture.detectChanges();
    expect(visibleInput().value).toBe('Independencia');
    expect(visibleInput().disabled).toBeTrue();
    expect(component.datosForm.getRawValue()).toEqual(jasmine.objectContaining({
      calleRepresentante: 'Calle', numeroExteriorRepresentante: '2', codigoPostalRepresentante: '56617',
      municipioRepresentante: 'Valle de Chalco Solidaridad', estadoRepresentante: 'México', locationIDRepresentante: ''
    }));
    expect(component.comercioForm.getRawValue().tipoComercio).toBe('Sucursales Únicas');
    http.expectNone(req => !req.url.startsWith('/api/comercios/'));
  });

  it('selecciona por descripción cuando las opciones llegan después del dato', fakeAsync(() => {
    http.expectOne(accountUrl()).flush(information('Independencia'));
    fixture.detectChanges();
    setTimeout(() => { component.localidadesRepresentante = [{ colonia: 'Otra colonia' }, { colonia: 'Independencia' }]; }, 10);
    tick(10);
    fixture.detectChanges();
    expect(visibleSelect().value).toBe('Independencia');
    expect(component.datosForm.controls.coloniaRepresentante.value).toBe('Independencia');
  }));

  it('selecciona al llegar el dato cuando las opciones ya estaban disponibles', fakeAsync(() => {
    component.localidadesRepresentante = [{ colonia: 'Otra colonia' }, { colonia: 'Independencia' }];
    const req = http.expectOne(accountUrl());
    fixture.detectChanges();
    setTimeout(() => req.flush(information('Independencia')), 10);
    tick(10);
    fixture.detectChanges();
    expect(visibleSelect().value).toBe('Independencia');
  }));

  it('conserva un valor sin coincidencia y no pisa una corrección manual al cargar opciones', fakeAsync(() => {
    http.expectOne(accountUrl()).flush(information('Independencia'));
    component.localidadesRepresentante = [{ colonia: 'Otra colonia' }];
    fixture.detectChanges();
    expect(visibleInput().value).toBe('Independencia');
    // Simula el control habilitado por los permisos existentes, sin alterarlos en producción.
    component.datosForm.controls.coloniaRepresentante.enable({ emitEvent: false });
    fixture.detectChanges();
    visibleInput().value = 'Colonia corregida';
    visibleInput().dispatchEvent(new Event('input'));
    setTimeout(() => { component.localidadesRepresentante = [{ colonia: 'Independencia' }]; }, 10);
    tick(10);
    fixture.detectChanges();
    expect(visibleInput().value).toBe('Colonia corregida');
    expect(component.datosForm.controls.coloniaRepresentante.value).toBe('Colonia corregida');
  }));

  it('no selecciona la primera opción cuando falta colonia', () => {
    http.expectOne(accountUrl()).flush(information());
    component.localidadesRepresentante = [{ colonia: 'Otra colonia' }];
    fixture.detectChanges();
    expect(visibleSelect().value).toBe('');
    expect(component.datosForm.controls.coloniaRepresentante.value || '').toBe('');
  });

  it('limpia la colonia al cambiar de nodo y cancela las respuestas anteriores', () => {
    http.expectOne(accountUrl()).flush(information('Independencia'));
    fixture.detectChanges();
    expect(visibleInput().value).toBe('Independencia');
    component.seleccionarNodo(component.arbol[0].hijos![0]);
    const delayed = http.expectOne(accountUrl(branch));
    expect(component.datosForm.controls.coloniaRepresentante.value || '').toBe('');
    component.seleccionarNodo(component.arbol[0]);
    expect(delayed.cancelled).toBeTrue();
    http.expectOne(accountUrl()).flush(information('Colonia actual'));
    fixture.detectChanges();
    expect(visibleInput().value).toBe('Colonia actual');
    component.seleccionarNodo(component.arbol[0].hijos![0]);
    http.expectOne(accountUrl(branch)).flush(information());
    fixture.detectChanges();
    expect(visibleInput().value).toBe('');
    http.expectNone(req => !req.url.startsWith('/api/comercios/'));
  });
});
