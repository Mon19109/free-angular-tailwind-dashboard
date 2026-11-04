import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RegistroClienteComponent } from './registroCliente.component';

const ref = '11111111-1111-4111-8111-111111111111';
const branch = '22222222-2222-4222-8222-222222222222';
const accountUrl = (node = ref) => `/api/comercios/${ref}/nodos/${node}/informacion-general`;
const information = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  information: {
    nameCommerce: 'Comercio de prueba', personType: 'PF', tipoComercio: 'Persona Física',
    fiscalRegime: '999', fiscalRegimeDescription: 'Régimen fiscal autorizado',
    activityDescription: 'Actividad autorizada',
    commerceAddress: [
      { addressType: 'DF', postalCode: '56617', district: 'Colonia fiscal', municipality: 'Municipio fiscal', federativeEntity: 'Estado fiscal' },
      { addressType: 'DC', postalCode: '56618', district: 'Colonia comercial', municipality: 'Municipio comercial', federativeEntity: 'Estado comercial' }
    ],
    ...overrides
  },
  permissions: { editInformation: true, editFields: ['nombreComercial'] }
});

describe('Catálogos administrativos de lectura en Consulta de Comercios', () => {
  let fixture: ComponentFixture<RegistroClienteComponent>;
  let component: RegistroClienteComponent;
  let http: HttpTestingController;
  const input = (name: string) => fixture.nativeElement.querySelector(`input[formControlName="${name}"]`) as HTMLInputElement;
  const select = (name: string) => fixture.nativeElement.querySelector(`app-select[formControlName="${name}"] select`) as HTMLSelectElement;
  const selectedText = (name: string) => select(name).selectedOptions[0]?.textContent?.trim();

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({ ref }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params } }
    ] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).actualizarSesion({ success: true, authenticated: true,
      expiresAt: Date.now() + 60000, usuario: { idRol: 2 } });
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
    http.expectNone(request => !request.url.startsWith('/api/comercios/'));
    http.expectNone(request => request.method !== 'GET');
    for (const request of http.match(req => /\/(pld|documentos)$/.test(req.url))) {
      if (!request.cancelled) request.flush({}, { status: 503, statusText: 'Unavailable' });
    }
    http.verify();
  });

  it('muestra actividad PF, régimen y colonias DF/DC del mismo GET sin abrir búsquedas ni modificar valores', () => {
    const request = http.expectOne(accountUrl());
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(information());
    const originales = component.datosForm.getRawValue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-datos-generales-admin')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-step-datos')).toBeNull();
    expect(input('actividad').value).toBe('Actividad autorizada');
    expect(selectedText('regimenFiscal')).toBe('Régimen fiscal autorizado');
    expect(select('regimenFiscal').value).toBe('999');
    expect(select('regimenFiscal').disabled).toBeTrue();
    expect(selectedText('colonia')).toBe('Colonia fiscal');
    expect(selectedText('coloniaComercial')).toBe('Colonia comercial');
    expect(select('colonia').disabled).toBeTrue();
    expect(select('coloniaComercial').disabled).toBeTrue();
    expect(component.datosForm.getRawValue()).toEqual(originales);
    expect(component.datosForm.pristine).toBeTrue();
    input('actividad').dispatchEvent(new Event('focus'));
    input('actividad').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.giro-backdrop')).toBeNull();
    expect(fixture.nativeElement.querySelector('.btn-busqueda-avanzada')).toBeNull();
  });

  it('muestra familia, descripción y MCC de PM y mantiene la edición básica autorizada', () => {
    http.expectOne(accountUrl()).flush(information({ personType: 'PM', tipoComercio: 'Empresa Grupo',
      businessLine: 'Restaurantes', bussinesLineDescription: 'Restaurantes y cafeterías', businessActivityCode: '5812' }));
    fixture.detectChanges();
    expect(input('giroComercial').value).toBe('Restaurantes');
    expect(input('descripcionGiro').value).toBe('Restaurantes y cafeterías');
    expect(input('mcc').value).toBe('5812');
    for (const name of ['giroComercial', 'descripcionGiro', 'mcc']) expect(input(name).readOnly).toBeTrue();
    expect(input('actividad')).toBeNull();
    expect(input('nombreComercial').disabled).toBeFalse();
    input('nombreComercial').value = 'Nombre corregido';
    input('nombreComercial').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.datosForm.controls.nombreComercial.value).toBe('Nombre corregido');
    expect(component.datosForm.controls.giroComercial.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Actualizar datos');
  });

  it('conserva los valores originales sin coincidencia ni descripción de régimen', () => {
    http.expectOne(accountUrl()).flush(information({ fiscalRegimeDescription: null,
      activityDescription: 'Actividad original sin coincidencia',
      commerceAddress: [
        { addressType: 'DF', postalCode: '56617', district: 'Colonia fiscal original' },
        { addressType: 'DC', postalCode: '56618', district: 'Colonia comercial original' }
      ] }));
    fixture.detectChanges();
    expect(selectedText('regimenFiscal')).toBe('999');
    expect(input('actividad').value).toBe('Actividad original sin coincidencia');
    expect(selectedText('colonia')).toBe('Colonia fiscal original');
    expect(selectedText('coloniaComercial')).toBe('Colonia comercial original');
    // Las opciones que lleguen después tampoco deben sustituir el valor por la primera opción.
    component.localidadesFiscal = [{ colonia: 'Otra colonia' }];
    component.localidadesComercial = [{ colonia: 'Otra colonia comercial' }];
    fixture.detectChanges();
    expect(select('colonia').value).toBe('Colonia fiscal original');
    expect(select('coloniaComercial').value).toBe('Colonia comercial original');
    expect(select('colonia').disabled).toBeTrue();
    expect(select('coloniaComercial').disabled).toBeTrue();
    expect(component.datosForm.pristine).toBeTrue();
  });

  it('conserva opciones y valor del régimen preexistente al cambiar sólo su etiqueta visible', () => {
    http.expectOne(accountUrl()).flush(information({ fiscalRegime: '601' }));
    fixture.detectChanges();
    const valorOriginal = component.datosForm.controls.regimenFiscal.value;
    expect(valorOriginal).toBe('601 - General de Ley Personas Morales');
    expect(select('regimenFiscal').value).toBe(valorOriginal);
    expect(selectedText('regimenFiscal')).toBe('Régimen fiscal autorizado');
    expect(select('regimenFiscal').disabled).toBeTrue();
    const valores = Array.from(select('regimenFiscal').options).map(option => option.value);
    for (const regimen of component.regimenesFiscales) expect(valores).toContain(regimen);
    component.descripcionRegimenFiscal = '';
    fixture.detectChanges();
    expect(select('regimenFiscal').value).toBe(valorOriginal);
    expect(selectedText('regimenFiscal')).toBe(valorOriginal);
    expect(select('regimenFiscal').disabled).toBeTrue();
    expect(component.datosForm.pristine).toBeTrue();
  });

  it('mantiene el componente y la búsqueda de giro preexistentes fuera del contexto BFF', () => {
    http.expectOne(accountUrl()).flush(information({ personType: 'PM', tipoComercio: 'Empresa Grupo' }));
    // La rama heredada conserva su componente; la consulta administrativa no lo instancia.
    Object.defineProperty(component, 'modoContextoBff', { value: false });
    component.editandoDatosNodo = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-datos-generales-admin')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-step-datos')).not.toBeNull();
    const busqueda = fixture.nativeElement.querySelector('.btn-busqueda-avanzada') as HTMLButtonElement;
    expect(busqueda).not.toBeNull();
    busqueda.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.giro-backdrop')).not.toBeNull();
  });

  it('limpia etiquetas al cambiar de nodo y cancela la respuesta enriquecida anterior', () => {
    http.expectOne(accountUrl()).flush(information());
    fixture.detectChanges();
    expect(selectedText('regimenFiscal')).toBe('Régimen fiscal autorizado');
    component.seleccionarNodo(component.arbol[0].hijos![0]);
    const delayed = http.expectOne(accountUrl(branch));
    expect(component.descripcionRegimenFiscal).toBe('');
    expect(component.datosForm.controls.colonia.value || '').toBe('');
    component.seleccionarNodo(component.arbol[0]);
    expect(delayed.cancelled).toBeTrue();
    http.expectOne(accountUrl()).flush(information({ fiscalRegime: '777', fiscalRegimeDescription: null,
      activityDescription: 'Actividad del nodo actual', commerceAddress: [] }));
    fixture.detectChanges();
    expect(select('regimenFiscal').value).toBe('777');
    expect(selectedText('regimenFiscal')).toBe('777');
    expect(input('actividad').value).toBe('Actividad del nodo actual');
    expect(component.datosForm.controls.colonia.value || '').toBe('');
    expect(component.datosForm.controls.coloniaComercial.value || '').toBe('');
  });
});
