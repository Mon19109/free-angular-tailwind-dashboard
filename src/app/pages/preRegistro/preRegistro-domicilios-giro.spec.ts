import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PreRegistroComponent } from './preRegistro.component';
import { StepDatosComponent } from './components/datos-generales/step-datos.component';
import { TiposNegocioComponent } from './components/tipos-negocio/tipos-negocio.component';
import { PreRegistroService } from '../../services/preregistro.service';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { PreregistroAvanceService } from '../../services/preregistro-avance.service';

describe('Preregistro: domicilios y selección de giro en actualizaciones', () => {
  let c: any;
  let api: jasmine.SpyObj<PreregistroAvanceService>;
  let nodes: any[];
  const mappings: Record<string, string> = {
    tipoVialidad: 'roadType', nombreVialidad: 'roadName', numeroExterior: 'extNum', numeroInterior: 'intNum',
    colonia: 'district', localidad: 'location', municipio: 'municipality', entidadFederativa: 'federativeEntity',
    codigoPostal: 'postalCode', entreCalle: 'betweenStreet', yCalle: 'andStreet', locationID: 'locationID',
  };
  const address = (label: string, suffix = '') => Object.fromEntries(Object.keys(mappings).map(key => [key + suffix, label + key]));
  const capture = (i: number) => ({ tipoPersona: 'PM', nombreComercial: 'Nodo ' + i, mismaInfoFiscalEntidad: false,
    giroComercial: 'Familia ' + i, giroId: String(540 + i), descripcionGiro: 'Descripción ' + i, mcc: String(7277 + i),
    ...address('Fiscal' + i), ...address('Comercial' + i, 'Comercial') });
  function select(node: any): void {
    c.arbolNegocioForm.controls.nodoSeleccionado.setValue(node.id, { emitEvent: false });
    c.comercioForm.patchValue(c.obtenerComercioPorNodo()[node.id], { emitEvent: false });
    c.cargarDatosSucursal(node.id);
  }
  beforeEach(() => {
    api = jasmine.createSpyObj('avance', ['actualizar', 'crear', 'consultar', 'subirDocumentos']);
    api.actualizar.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ChangeDetectorRef, useValue: { detectChanges() {} } },
      { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: RegimenFiscalService, useValue: { getAllOptions: () => of([]) } },
      { provide: PreRegistroService, useValue: { getTiposComercio: () => of([]), getGirosByFamily: () => of({ data: [
        { idBussinesLine: 540, giro: 7277, familia: 'Otros', descripcion: 'ASESOR - FINANCIERO' },
      ] }) } },
      { provide: PreregistroAvanceService, useValue: api },
    ] });
    c = TestBed.runInInjectionContext(() => new PreRegistroComponent());
    c.tipoNegocioSeleccionado = new TiposNegocioComponent().tiposNegocio.find(tipo => tipo.id === 'sucursales-multiples');
    c.arbolNegocioForm.controls.sucursalesPorEntidad.setValue('[2]', { emitEvent: false });
    const root = c.arbolNegocioWizard[0]; nodes = [root, ...root.hijos];
    c.tiposComercioCatalogoPorNivel = { Entidad: [{ id: 41, nombre: 'Empresa Grupo' }], Sucursal: [{ id: 52, nombre: 'Sucursales de Grupo' }], Caja: [{ id: 61, nombre: 'Cuenta Terminal Pin Rapido' }] };
    c.typeOfBusinessPorTipoComercio = { 'Empresa Grupo': 41, 'Sucursales de Grupo': 52, 'Cuenta Terminal Pin Rapido': 61 };
    c.arbolNegocioForm.controls.comercioPorNodo.setValue(JSON.stringify(Object.fromEntries(nodes.map((n, i) => [n.id,
      { nivel: i ? 'Sucursal' : 'Entidad', tipoComercio: i ? 'Sucursales de Grupo' : 'Empresa Grupo', tipoComercioId: i ? 52 : 41 }]))));
    c.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify(Object.fromEntries(nodes.map((n, i) => [n.id, capture(i)]))));
    c.prospectoCreado = true;
    c.comprobanteAvance = 'a'.repeat(64);
    c.guidsRegistrados = Object.fromEntries(nodes.map((n, i) => [n.id, `00000000-0000-4000-8000-00000000000${i}`]));
    spyOn(c, 'guardarBorradorSilencioso');
    select(nodes[0]);
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('conserva DF/DC propios y giros distintos al recuperar entidad y dos sucursales', () => {
    for (const i of [1, 2, 0, 1]) {
      select(nodes[i]); c.guardarDatosSucursalActual();
      const data = c.datosActualizacion(nodes[i].id);
      expect(data.idBussinesLine).toBe(540 + i);
      expect(data.businessActivityCode).toBe(String(7277 + i));
      expect(data.bussinesLineDescription).toBe('Descripción ' + i);
      expect(data.typeOfBusiness).toBe(i ? 52 : 41);
      for (const [field, upstream] of Object.entries(mappings)) {
        expect(data.commerceAddress[0][upstream]).withContext(field).toBe('Fiscal' + i + field);
        expect(data.commerceAddress[1][upstream]).withContext(field).toBe('Comercial' + i + field);
      }
      expect(data.commerceAddress.map((a: any) => a.addressType)).toEqual(['DF', 'DC']);
    }
  });
  it('copia los valores actuales del fiscal, incluidos opcionales vacíos y campos deshabilitados', () => {
    select(nodes[1]);
    c.datosForm.controls.mismoDomicilio.setValue(true);
    c.datosForm.patchValue({ nombreVialidad: 'Calle editada', entreCalle: '', yCalle: '' }, { emitEvent: false });
    c.datosForm.controls.nombreVialidad.disable({ emitEvent: false });
    c.guardarDatosSucursalActual();
    const [df, dc] = c.datosActualizacion(nodes[1].id).commerceAddress;
    expect(dc).toEqual({ ...df, addressType: 'DC' });
    expect(dc.roadName).toBe('Calle editada'); expect(dc.betweenStreet).toBe(''); expect(dc.andStreet).toBe('');
  });
  it('al desmarcar la copia conserva el comercial y permite editar ambos independientemente', () => {
    select(nodes[1]); c.datosForm.controls.mismoDomicilio.setValue(true);
    c.datosForm.controls.mismoDomicilio.setValue(false);
    expect(c.datosForm.controls.nombreVialidadComercial.value).toBe('Fiscal1nombreVialidad');
    c.datosForm.patchValue({ nombreVialidadComercial: 'Local independiente' }, { emitEvent: false });
    c.guardarDatosSucursalActual(); select(nodes[2]); select(nodes[1]);
    const [df, dc] = c.datosActualizacion(nodes[1].id).commerceAddress;
    expect(df.roadName).toBe('Fiscal1nombreVialidad'); expect(dc.roadName).toBe('Local independiente');
  });
  it('guarda el ID del catálogo seleccionado, separado de MCC y tipo de comercio', () => {
    const step = TestBed.runInInjectionContext(() => new StepDatosComponent());
    step.form = c.datosForm; step.preregistroPublico = true;
    step.buscarGirosComerciales('Otros'); step.seleccionarGiroModal(step.girosBusqueda[0]); step.guardarGiroModal();
    expect(c.datosForm.controls.giroId.value).toBe('540');
    c.guardarDatosSucursalActual();
    const data = c.datosActualizacion(nodes[0].id);
    expect(data.idBussinesLine).toBe(540); expect(data.businessActivityCode).toBe('7277');
    expect(data.bussinesLineDescription).toBe('ASESOR - FINANCIERO'); expect(data.typeOfBusiness).toBe(41);
  });
  it('no convierte el MCC en ID cuando falta una selección válida', () => {
    c.datosForm.controls.giroId.setValue(''); c.guardarDatosSucursalActual();
    expect(() => c.datosActualizacion(nodes[0].id)).toThrowError(/Giro pendiente/);
  });
  it('conserva actividad y su referencia independiente del giro durante la actualización', () => {
    c.datosForm.patchValue({ actividadId: '281474976710700', actividad: 'Gasolinerías', giroId: '', mcc: '', descripcionGiro: '' }, { emitEvent: false });
    c.guardarDatosSucursalActual();
    const data = c.datosActualizacion(nodes[0].id);
    expect(data.idActivity).toBe(281474976710700); expect(data.activityDescription).toBe('Gasolinerías'); expect(data.idBussinesLine).toBe(0);
  });
  it('envía datos del nodo, conserva la captura tras un error y reintenta sin otra alta', () => {
    select(nodes[1]); spyOn(c, 'formularioCompleto').and.returnValue(true); spyOn(c, 'avanzarDespuesDeDatos');
    api.actualizar.and.returnValue(throwError(() => new Error('Fallo simulado')));
    c.continuarDatos();
    expect(c.datosForm.controls.nombreVialidad.value).toBe('Fiscal1nombreVialidad');
    api.actualizar.and.returnValue(of({ success: true })); c.continuarDatos();
    expect(api.actualizar).toHaveBeenCalledTimes(2); expect(api.crear).not.toHaveBeenCalled();
    const [receipt, node, data] = api.actualizar.calls.mostRecent().args;
    expect(receipt).toBe('a'.repeat(64)); expect(node).toBe(nodes[1].id);
    expect((data as any).commerceAddress[0].roadName).toBe('Fiscal1nombreVialidad');
    expect((data as any).idBussinesLine).toBe(541);
  });
  it('prepara el primer registro sin exigir GUID previo', () => {
    c.prospectoCreado = false; c.guidsRegistrados = {};
    const data = c.datosActualizacion(nodes[0].id);
    expect(data.commerceGuid).toBeUndefined();
    expect(data.commerceAddress.every((a: any) => a.commerceID === null && a.commerceAddressID === null)).toBeTrue();
  });
  it('update manda captura DF/DC y locationID sin imponer identidades del navegador', () => {
    select(nodes[1]); c.datosForm.controls.mismoDomicilio.setValue(true); c.guardarDatosSucursalActual();
    const data = c.datosActualizacion(nodes[1].id);
    expect(data.commerceGuid).toBeUndefined();
    for (const a of data.commerceAddress) {
      expect(a.commerceID).toBeUndefined(); expect(a.commerceAddressID).toBeUndefined();
      expect(a.locationID).toBe('Fiscal1locationID');
    }
    expect(data.commerceAddress[0].roadName).toBe(data.commerceAddress[1].roadName);
  });

});
