import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
    spyOn<any>(component, 'guardarBorradorSilencioso');
    spyOn(component, 'irAlPaso');
  });

  afterEach(() => http.verify());

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

  it('lee accountResponse.nodeId y no avanza si falta la referencia', () => {
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation'))
      .flush({ success: true, accountResponse: { nodeId: 6, parentNodeId: 0 } });
    expect(component['referenciaAfiliacionPayload']()).toEqual({ referrerNodeId: 6 });
    (component.irAlPaso as jasmine.Spy).calls.reset();
    component.continuarAfiliacion();
    http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation')).flush({ success: true });
    expect(component.irAlPaso).not.toHaveBeenCalled();
    expect(component.errorAfiliacion).toContain('identificador de referencia');
  });

  function validar(nodeId: number | string = 6) {
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    const request = http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation'));
    expect(request.request.body).toEqual({ affiliationNumber: '12345' });
    request.flush({ success: true, accountResponse: { nodeId, parentNodeId: 0 } });
  }

  function referencias(objeto: any): number[] {
    if (!objeto || typeof objeto !== 'object') return [];
    return [
      ...(Object.hasOwn(objeto, 'referrerNodeId') ? [objeto.referrerNodeId] : []),
      ...Object.values(objeto).flatMap(referencias)
    ];
  }

  for (const tipo of ['individual', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    for (const nodeId of [6, 812]) {
    it(`envía el nodeId ${nodeId} del servicio únicamente en el padre de ${tipo}`, () => {
      validar(String(nodeId));
      component.tipoNegocioSeleccionado = { id: tipo } as any;
      const sucursal = { id: 'sucursal-1', nombre: 'Sucursal', nivel: 'sucursal', ruta: '', hijos: [] };
      const entidad = { id: 'entidad-1', nombre: 'Entidad', nivel: 'entidad', ruta: '', hijos: [sucursal] };
      const holding = { id: 'sub-afiliado-1', nombre: 'Holding', nivel: 'sub-afiliado', ruta: '', hijos: [entidad] };
      spyOnProperty(component, 'arbolNegocioWizard').and.returnValue([holding] as any);
      spyOn<any>(component, 'nodoBranchOfficeActualId').and.returnValue(sucursal.id);
      spyOn<any>(component, 'construirComercioPayload').and.callFake((id: string) => ({
        nameCommerce: id, poss: [{ nameCommerce: 'Caja' }]
      }));
      spyOn<any>(component, 'construirPossPayloadPorSucursal').and.returnValue([{ nameCommerce: 'Caja' }]);

      const payload: any = component['construirPayloadPreRegistro']();
      const padre = tipo === 'empresa-holding' ? payload
        : tipo === 'individual' ? payload.entitys[0].branchOficces[0] : payload.entitys[0];
      expect(padre.referrerNodeId).toBe(nodeId);
      expect(referencias(payload)).toEqual([nodeId]);
    });
    }
  }

  it('descarta la referencia al editar la afiliación o recibir una validación fallida', () => {
    validar();
    component.afiliacionForm.controls.afiliacion.setValue('98765');
    expect(component['referenciaAfiliacionPayload']()).toEqual({});
    component.continuarAfiliacion();
    http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation'))
      .flush({ success: false, nodeId: 8, error: { message: 'Afiliación inválida' } });
    expect(component['referenciaAfiliacionPayload']()).toEqual({});
  });

  it('ignora el nodeId de una respuesta si cambió la afiliación durante la consulta', () => {
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    component.afiliacionForm.controls.afiliacion.setValue('98765');
    http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation')).flush({ success: true, nodeId: 6 });
    expect(component['referenciaAfiliacionPayload']()).toEqual({});
    expect(component.irAlPaso).not.toHaveBeenCalled();
  });
});
