import { Validators } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../environments/environments';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { PreRegistroComponent } from './preRegistro.component';
import { StepDatosComponent } from './components/datos-generales/step-datos.component';

describe('PreRegistro: referencia de afiliación', () => {
  let component: PreRegistroComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ChangeDetectorRef, useValue: { detectChanges() {} } },
        { provide: RegimenFiscalService, useValue: { getAllOptions: () => of([]) } }
      ]
    });
    component = TestBed.runInInjectionContext(() => new PreRegistroComponent());
    http = TestBed.inject(HttpTestingController);
    component.envioPreRegistroRealizado = false;
    spyOn<any>(component, 'guardarBorradorSilencioso');
    spyOn(component, 'irAlPaso');
  });

  afterEach(() => http.verify());

  it('no arrastra pasos completados al pasar de una entidad incompleta a una sucursal', () => {
    component.tipoNegocioSeleccionado = { id: 'sucursales-multiples' } as any;
    spyOn<any>(component, 'cargarTiposComercioCatalogo');
    const entidad = component.arbolNegocioWizard[0];
    const sucursal = entidad.hijos![0];
    component.seleccionarNodoArbol(entidad);
    component.pasosCompletados = new Set([1, 2, 3, 4, 5]);
    component.seleccionarNodoArbol(sucursal);
    component.comercioForm.patchValue({ nivel: 'Sucursal', tipoComercio: 'Sucursales Únicas' }, { emitEvent: false });
    component['actualizarValidadoresDatos']();
    expect(component.esPasoCompletado(2)).toBeFalse();
    expect(component.esPasoCompletado(5)).toBeFalse();
    expect(component.nodoArbolCompletado(sucursal.id)).toBeFalse();
    expect(component.nodoArbolCompletado(entidad.id)).toBeFalse();
    component.seleccionarNodoArbol(entidad);
    expect(component.esPasoCompletado(2)).toBeFalse();
    expect(component.esPasoCompletado(5)).toBeFalse();
  });

  it('marca datos completos solo con los obligatorios válidos y lo revoca al borrar uno', () => {
    component.comercioForm.patchValue({ nivel: 'Sucursal', tipoComercio: 'Sucursales Únicas' }, { emitEvent: false });
    component.datosForm.controls.tipoPersona.setValue('PM', { emitEvent: false });
    component['actualizarValidadoresDatos']();
    component.pasosCompletados.add(2);
    expect(component.esPasoCompletado(2)).toBeFalse();
    for (const [nombre, control] of Object.entries(component.datosForm.controls)) {
      if (!control.hasValidator(Validators.required)) continue;
      const valor = nombre === 'tipoPersona' ? 'PM'
        : nombre === 'rfc' ? 'JUG160730I9A'
        : nombre.toLowerCase().includes('correo') ? 'comercio@example.com'
        : nombre.toLowerCase().includes('telefono') ? '5512345678'
        : nombre.toLowerCase().includes('codigopostal') ? '01000' : 'Dato';
      control.setValue(valor as never, { emitEvent: false });
    }
    expect(component.datosForm.valid).toBeTrue();
    expect(component.datosForm.controls.telefonoAdicionalComercial.value).toBe('');
    expect(component.esPasoCompletado(2)).toBeTrue();
    component.datosForm.controls.correoComercial.setValue('', { emitEvent: false });
    component.datosForm.controls.telefonoComercial.setValue('', { emitEvent: false });
    expect(component.esPasoCompletado(2)).toBeTrue();
    component.datosForm.controls.correoComercial.setValue('correo-invalido', { emitEvent: false });
    expect(component.esPasoCompletado(2)).toBeFalse();
  });

  it('exige solo documentos obligatorios y respeta los adicionales para persona moral', () => {
    component.comercioForm.patchValue({ nivel: 'Sucursal', tipoComercio: 'Sucursales Únicas' }, { emitEvent: false });
    component.datosForm.controls.tipoPersona.setValue('PM', { emitEvent: false });
    component.datosForm.patchValue({ correo: 'comercio@example.com', telefono: '5512345678' }, { emitEvent: false });
    component.pasosCompletados.add(5);
    expect(component.esPasoCompletado(5)).toBeFalse();
    const documentos = component.documentosVisibles;
    expect(documentos.filter(documento => documento.obligatorio).length).toBeGreaterThan(0);
    for (const documento of documentos.filter(documento => documento.obligatorio)) {
      component['guardarDocumentoNodoActual']({ ...documento, archivoNombre: 'documento.pdf' });
    }
    expect(component.documentosVisibles.some(documento => !documento.obligatorio && !documento.archivoNombre)).toBeTrue();
    expect(component.esPasoCompletado(5)).toBeTrue();
    component['guardarDocumentoNodoActual']({ ...documentos.find(documento => documento.obligatorio)!, archivoNombre: undefined });
    expect(component.esPasoCompletado(5)).toBeFalse();
  });

  for (const tipo of ['Entidad Agrupadora con auditor', 'Entidad Agrupadora con supervisor']) {
    it(`muestra los campos de representante que exige el formulario de ${tipo}`, () => {
      component.comercioForm.patchValue({ nivel: 'Entidad', tipoComercio: tipo }, { emitEvent: false });
      component.datosForm.controls.tipoPersona.setValue('PM', { emitEvent: false });
      component['actualizarValidadoresDatos']();
      const step = TestBed.runInInjectionContext(() => new StepDatosComponent());
      step.form = component.datosForm;
      step.tipoComercio = tipo;
      expect(component.datosForm.controls.nombreRepresentante.hasError('required')).toBeTrue();
      expect(step.seccionesVisibles.representante).toBeTrue();
      expect(step.seccionesVisibles.dirRepresentante).toBeTrue();
      component.datosForm.controls.tipoPersona.setValue('PF', { emitEvent: false });
      expect(step.seccionesVisibles.representante).toBeFalse();
    });
  }

  it('conserva el nombre editado de caja en el árbol y en el payload', () => {
    component.tipoNegocioSeleccionado = { id: 'auditor-unico' } as any;
    const entidad = component.arbolNegocioWizard[0];
    const caja = entidad.hijos![0].hijos![0];
    component.arbolNegocioForm.controls.nodoSeleccionado.setValue(caja.id);
    component.renombrarNodoArbol(caja.id, 'Caja juguetería');
    component['actualizarNombreSucursalDesdeDatos'](caja.id, { nombreComercial: 'Nombre del padre' });
    expect(component.nombreCajaSeleccionada).toBe('Caja juguetería');
    const actual = component['buscarNodoArbol'](caja.id)!;
    const payload = component['construirPosPayload'](actual, 0, {});
    expect(payload.nameCommerce).toBe('Caja juguetería');
    expect(payload.name).toBe('Caja juguetería');
  });

  it('usa el nombre comercial del nodo padre y recurre a businessName si falta', () => {
    expect(component['nombreComercioDelNodoPadre']({
      entitys: [{
        nameCommerce: 'Comercio principal',
        businessName: 'Razón social principal',
        branchOficces: [{ nameCommerce: 'Sucursal' }]
      }]
    })).toBe('Comercio principal');

    expect(component['nombreComercioDelNodoPadre']({
      entitys: [{ businessName: 'Razón social principal' }]
    })).toBe('Razón social principal');
  });

  it('avanza de datos a documentos de agrupadora y después selecciona la sucursal', () => {
    component.tipoNegocioSeleccionado = { id: 'auditor-unico' } as any;
    const entidad = component.arbolNegocioWizard[0];
    component.arbolNegocioForm.patchValue({ nodoSeleccionado: entidad.id, nivelSeleccionado: 'entidad' });
    component.comercioForm.patchValue({ nivel: 'Entidad', tipoComercio: 'Entidad Agrupadora con auditor', tipoComercioId: 5 }, { emitEvent: false });
    component.datosForm.controls.tipoPersona.setValue('PM', { emitEvent: false });
    component.pasoActual = 2;
    // Este caso verifica la navegación cuando la captura ya pasó sus validaciones.
    spyOnProperty(component.datosForm, 'invalid').and.returnValue(false);
    spyOn<any>(component, 'primerPasoInvalido').and.returnValue(null);
    spyOn<any>(component, 'cargarTiposComercioCatalogo');
    (component.irAlPaso as jasmine.Spy).and.callThrough();
    component.continuarDatos();
    expect(Number(component.pasoActual)).toBe(5);
    expect(component.arbolNegocioForm.controls.nodoSeleccionado.value).toBe(entidad.id);
    expect(component.documentosVisibles.length).toBeGreaterThan(0);
    component.documentosVisibles.forEach(documento => {
      component['guardarDocumentoNodoActual']({ ...documento, archivoNombre: `${documento.numero}.pdf` });
    });
    component.finalizarRegistro();
    expect(component.arbolNegocioForm.controls.nodoSeleccionado.value).toBe(entidad.hijos![0].id);
    expect(component.comercioForm.controls.nivel.value).toBe('Sucursal');
    expect(Number(component.pasoActual)).not.toBe(5);
    expect(component.enviandoPreRegistro).toBeFalse();
  });

  const url = environment.preregistroBff.validarAfiliacionUrl;
  const comprobante = 'a'.repeat(64);

  function validar(): void {
    component.afiliacionForm.controls.afiliacion.setValue('0012345');
    component.continuarAfiliacion();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({ affiliationNumber: '0012345' });
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, comprobante, expiresIn: 900 });
  }

  it('acepta el contrato sin nodeId y reutiliza el comprobante vigente', () => {
    validar();
    expect(component['comprobanteAfiliacion']).toBe(comprobante);
    expect(component['referenciaAfiliacionPayload']()).toEqual({});
    expect(component.irAlPaso).toHaveBeenCalledWith(6);
    component.continuarAfiliacion();
    http.expectNone(url);
  });

  it('exige renovar al vencer y no envía el registro automáticamente', () => {
    let ahora = 1000000;
    spyOn(Date, 'now').and.callFake(() => ahora);
    validar();
    ahora += 900000;
    component['enviarPreRegistroCompleto']({});
    http.expectNone(environment.preregistroBff.registroCompletoUrl);
    expect(component.irAlPaso).toHaveBeenCalledWith(0);
    expect(component.errorAfiliacion).toContain('venció');
    component.continuarAfiliacion();
    http.expectOne(url).flush({ success: true, comprobante, expiresIn: 900 });
    http.expectNone(environment.preregistroBff.registroCompletoUrl);
  });

  it('invalida el comprobante al cambiar la afiliación', () => {
    validar();
    component.afiliacionForm.controls.afiliacion.setValue('98765');
    expect(component['comprobanteAfiliacion']).toBe('');
    expect(component['comprobanteAfiliacionVigente']()).toBeFalse();
  });

  it('ignora respuestas obsoletas incluso si el número vuelve a su valor inicial', () => {
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    component.afiliacionForm.controls.afiliacion.setValue('98765');
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    http.expectOne(url).flush({ success: true, comprobante, expiresIn: 900 });
    expect(component['comprobanteAfiliacion']).toBe('');
    expect(component.irAlPaso).not.toHaveBeenCalled();
  });

  it('respeta Retry-After sin marcar el formulario inválido ni reintentar automáticamente', () => {
    let ahora = 1000000;
    spyOn(Date, 'now').and.callFake(() => ahora);
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    http.expectOne(url).flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '120' } });
    component.continuarAfiliacion();
    http.expectNone(url);
    expect(component.errorAfiliacion).toContain('120 segundos');
    expect(component.afiliacionForm.valid).toBeTrue();
    ahora += 120000;
    component.continuarAfiliacion();
    http.expectOne(url).flush({ success: true, comprobante, expiresIn: 900 });
  });

  for (const respuesta of [
    { success: true, comprobante: 'incorrecto', expiresIn: 900 },
    { success: true, comprobante, expiresIn: 0 },
    { success: true, comprobante },
    { success: false, comprobante, expiresIn: 900 },
  ]) {
    it('rechaza respuestas sin comprobante y vigencia válidos o sin éxito', () => {
      component.afiliacionForm.controls.afiliacion.setValue('12345');
      component.continuarAfiliacion();
      http.expectOne(url).flush(respuesta);
      expect(component['comprobanteAfiliacion']).toBe('');
      expect(component.irAlPaso).not.toHaveBeenCalled();
    });
  }
});
