import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RegistroAfiliacionComponent } from './registroAfiliacion.component';
import { AfiliacionesResponse } from '../../services/afiliaciones.service';

describe('RegistroAfiliacionComponent integrado con HTTP BFF', () => {
  let fixture: ComponentFixture<RegistroAfiliacionComponent>;
  let component: RegistroAfiliacionComponent;
  let http: HttpTestingController;
  const url = '/api/comercios/referencia-opaca/afiliaciones';
  const empty: AfiliacionesResponse = { success: true, name: 'Entidad raíz', affiliations: [], revision: 'revision', writeBlocked: false, message: '' };
  const existing: AfiliacionesResponse = { ...empty, affiliations: [
    { id: 20, processor: 'PROSA', number: '0012', businessLine: '0070' },
    { id: 10, processor: 'AMEX', number: '0034', businessLine: '0080' }
  ] };
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RegistroAfiliacionComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ ref: 'referencia-opaca' }) } } }
    ] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegistroAfiliacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => { http.verify(); fixture.destroy(); });
  function initial(response = empty) { http.expectOne(url).flush(response); fixture.detectChanges(); }
  function fill() {
    component.afiliacionAmex = '0034'; component.giroAmex = '0080';
    component.afiliacionProsa = '0012'; component.giroProsa = '0070';
    fixture.detectChanges();
  }
  it('consulta con referencia y cookies; bloquea mientras carga y muestra nombre raíz del BFF', () => {
    expect(fixture.nativeElement.textContent).toContain('Consultando afiliaciones...');
    expect(fixture.nativeElement.querySelector('input').disabled).toBeTrue();
    const req = http.expectOne(url); expect(req.request.method).toBe('GET'); expect(req.request.withCredentials).toBeTrue();
    req.flush(empty); fixture.detectChanges();
    expect(component.nombreComercio).toBe('Entidad raíz');
    expect(fixture.nativeElement.querySelector('app-processing-overlay')).toBeNull();
    expect(component.afiliacionAmex).toBe(''); expect(component.puedeGuardar).toBeFalse();
  });
  it('mapea IDs y campos por procesador independientemente del orden', () => {
    initial(existing); expect(component.afiliacionProsa).toBe('0012'); expect(component.giroAmex).toBe('0080');
    component.afiliacionAmex = '0099'; component.guardar();
    const req = http.expectOne(url); expect(req.request.method).toBe('PUT');
    expect(req.request.body.affiliations).toEqual([
      { id: 10, processor: 'AMEX', number: '0099', businessLine: '0080' },
      { id: 20, processor: 'PROSA', number: '0012', businessLine: '0070' }
    ]);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Actualizando afiliaciones...');
    req.flush({ ...existing, affiliations: existing.affiliations.map(row => row.processor === 'AMEX' ? { ...row, number: '0099' } : row) }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Actualización exitosa');
    expect(fixture.nativeElement.querySelector('.resultado-icono.exito')).not.toBeNull();
  });
  it('POST sin IDs, sin tokens, conserva ceros, evita doble clic y después usa PUT', () => {
    initial(); fill(); component.guardar(); component.guardar(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Guardando afiliaciones...');
    expect(fixture.nativeElement.querySelector('input').disabled).toBeTrue();
    const req = http.expectOne(url); expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Portal-Request')).toBe('1');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.body.affiliations[0]).toEqual({ processor: 'AMEX', number: '0034', businessLine: '0080' });
    expect(component.procesando).toBeTrue();
    req.flush(existing); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Registro exitoso');
    expect(fixture.nativeElement.textContent).toContain('Las afiliaciones se guardaron correctamente');
    expect(component.procesando).toBeFalse();
    component.resultado = null; component.afiliacionAmex = '0007'; component.guardar();
    const update = http.expectOne(url); expect(update.request.method).toBe('PUT'); update.flush({ ...existing, affiliations: existing.affiliations.map(row => row.processor === 'AMEX' ? { ...row, number: '0007' } : row) });
  });
  it('una sola afiliación informa limitación y no permite escritura', () => {
    initial({ ...existing, affiliations: [existing.affiliations[0]], writeBlocked: true, message: 'No se confirman operaciones parciales' });
    fill(); component.guardar(); http.expectNone(url);
    expect(component.bloqueado).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('No se confirman operaciones parciales');
  });
  for (const status of [400, 403, 500]) it(`error HTTP ${status}: cierra overlay, X roja y conserva captura`, () => {
    initial(); fill(); component.guardar();
    http.expectOne(url).flush({ message: 'No fue posible verificar el guardado' }, { status, statusText: 'Error' });
    fixture.detectChanges();
    expect(component.afiliacionAmex).toBe('0034'); expect(component.giroProsa).toBe('0070');
    expect(component.procesando).toBeFalse(); expect(component.puedeGuardar).toBeFalse();
    expect(fixture.nativeElement.querySelector('.resultado-icono.error')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-processing-overlay')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No fue posible verificar el guardado');
    component.resultado = null; component.consultar();
    const get = http.expectOne(url); expect(get.request.method).toBe('GET'); get.flush(existing);
    expect(component.verificado).toBeTrue();
  });
  it('confirmación incompleta conserva datos capturados y no muestra éxito', () => {
    initial(); fill(); component.guardar();
    http.expectOne(url).flush({ ...existing, affiliations: [existing.affiliations[0]] });
    expect(component.resultado?.exito).toBeFalse(); expect(component.afiliacionAmex).toBe('0034');
    expect(component.procesando).toBeFalse();
  });
  it('fallo GET no habilita alta ni muestra éxito', () => {
    http.expectOne(url).flush({}, { status: 502, statusText: 'Error' }); fixture.detectChanges();
    fill(); component.guardar(); http.expectNone(url);
    expect(component.verificado).toBeFalse(); expect(component.resultado?.exito).toBeFalse();
  });
  it('respuesta de negocio fallida y respuesta inválida no se aceptan como éxito', () => {
    initial(); fill(); component.guardar();
    http.expectOne(url).flush({ success: false });
    expect(component.resultado?.exito).toBeFalse(); expect(component.afiliacionAmex).toBe('0034');
    component.resultado = null; component.consultar();
    http.expectOne(url).flush({ ...empty, affiliations: [{ processor: 'OTRO' }] });
    expect(component.verificado).toBeFalse(); expect(component.procesando).toBeFalse();
  });
});
