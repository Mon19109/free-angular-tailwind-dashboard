import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { PreRegistroComponent } from './preRegistro.component';

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

  function validar(nodeId: number | string = 6) {
    component.afiliacionForm.controls.afiliacion.setValue('12345');
    component.continuarAfiliacion();
    const request = http.expectOne(req => req.url.endsWith('/commerce/validateAffiliation'));
    expect(request.request.body).toEqual({ affiliationNumber: '12345' });
    request.flush({ success: true, nodeId });
  }

  function referencias(objeto: any): number[] {
    if (!objeto || typeof objeto !== 'object') return [];
    return [
      ...(Object.hasOwn(objeto, 'referrerNodeId') ? [objeto.referrerNodeId] : []),
      ...Object.values(objeto).flatMap(referencias)
    ];
  }

  for (const tipo of ['individual', 'sucursales-multiples', 'auditor-unico', 'empresa-holding']) {
    it(`envía el nodeId numérico únicamente en el padre de ${tipo}`, () => {
      validar('6');
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
      expect(padre.referrerNodeId).toBe(6);
      expect(referencias(payload)).toEqual([6]);
    });
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
