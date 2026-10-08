import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { StepComercioComponent } from '../preRegistro/components/comercio/step-comercio.component';
import { RegistroClienteComponent } from './registroCliente.component';
import { RegistroProspectoClienteComponent } from '../registroProspectoCliente/registroProspectoCliente.component';

describe('RegistroCliente: pasos finales internos', () => {
  function pantalla(pendienteRevision: boolean, nivel = 'entidad', mesaDigital = false) {
    const component = Object.create(RegistroClienteComponent.prototype) as RegistroClienteComponent;
    Object.assign(component, {
      pendienteRevisionEdicion: pendienteRevision,
      nodeIDEdicion: 'nodo-entidad',
      secciones: [
        { id: 'comercio', titulo: 'Datos del Comercio' },
        { id: 'liquidacion', titulo: 'Cuenta de Liquidación' },
        { id: 'accesos', titulo: 'Accesos a Plataforma' }
      ]
    });
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
    Object.defineProperty(component, 'nivelSeleccionado', { value: nivel });
    Object.defineProperty(component, 'seccionesVisibles', {
      value: [{ id: 'comercio', titulo: 'Datos del Comercio' }]
    });
    return component;
  }

  it('añade los pasos finales solamente en pendientes de revisión', () => {
    expect(pantalla(true).pasosVisiblesRegistro.map(paso => paso.id))
      .toEqual(['comercio', 'liquidacion', 'accesos']);
    expect(pantalla(false).pasosVisiblesRegistro.map(paso => paso.id)).toEqual(['comercio']);
    expect(pantalla(true, 'caja').pasosVisiblesRegistro.map(paso => paso.id)).toEqual(['comercio']);
  });

  it('no permite cambiar de nodo durante el envío de liquidación o accesos', () => {
    const component = pantalla(true);
    component.nodoSeleccionado = 'entidad';
    component.registroFinal = { guardandoLiquidacion: true } as RegistroProspectoClienteComponent;
    component.seleccionarNodo({ id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal' });
    expect(component.nodoSeleccionado).toBe('entidad');
    component.registroFinal = { guardando: true } as RegistroProspectoClienteComponent;
    component.seleccionarNodo({ id: 'sucursal', nombre: 'Sucursal', nivel: 'sucursal' });
    expect(component.nodoSeleccionado).toBe('entidad');
  });

  for (const estados of [[], ['IN_REVIEW'], ['APPROVED', 'REJECTED'], ['APPROVED', '']]) {
    it(`impide continuar con documentos incompletos o sin aprobar: ${JSON.stringify(estados)}`, () => {
      const component = pantalla(true, 'entidad', true);
      component.documentosProspecto = estados.map(status => ({ status }));
      const modal = spyOn<any>(component, 'mostrarModalRegistro');
      const guardar = spyOn(component, 'guardarRevisionDocumentos');
      const completar = spyOn(component, 'completarPaso');

      component.continuarDesdeDocumentos();

      expect(modal).toHaveBeenCalled();
      expect(guardar).not.toHaveBeenCalled();
      expect(completar).not.toHaveBeenCalled();
    });
  }

  it('concluye la revisión sin abrir liquidación para Mesa Digital', () => {
    const component = pantalla(true, 'entidad', true);
    spyOn<any>(component, 'mostrarModalRegistro');
    component.nodoSeleccionado = 'entidad';
    component.seccionAbierta = 'documentos';
    component.documentosProspecto = [{ status: 'APPROVED' }, { documentStatus: 'APPROVED' }];
    let alGuardar: (() => void) | undefined;
    spyOn(component, 'guardarRevisionDocumentos').and.callFake((_finalizar, callback) => {
      alGuardar = callback;
    });
    const completar = spyOn(component, 'completarPaso');
    const siguienteNodo = spyOn(component, 'seleccionarSiguienteNodoArbol');

    component.continuarDesdeDocumentos();

    expect(component.seccionAbierta).toBe('documentos');
    expect(completar).not.toHaveBeenCalled();
    expect(alGuardar).toBeDefined();
    alGuardar!();
    expect(completar).toHaveBeenCalledWith('documentos');
    expect(component.seccionAbierta).toBe('documentos');
    expect(component.nodoSeleccionado).toBe('entidad');
    expect(siguienteNodo).not.toHaveBeenCalled();
  });

  it('conserva los pasos 1 a 3 para Mesa Digital y añade 4 y 5 solamente a los otros roles', () => {
    for (const mesaDigital of [true, false]) {
      const component = Object.create(RegistroClienteComponent.prototype) as RegistroClienteComponent;
      Object.assign(component, {
        pendienteRevisionEdicion: true, nodeIDEdicion: 'SUCURSAL-1',
        secciones: ['comercio', 'datos', 'liquidacion', 'accesos', 'documentos'].map(id => ({ id, titulo: id }))
      });
      Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
      Object.defineProperty(component, 'nivelSeleccionado', { value: 'sucursal' });
      expect(component.seccionesVisibles.map(item => item.id)).toEqual(
        ['comercio', 'datos', 'documentos']);
      expect(component.pasosVisiblesRegistro.map(item => item.id)).toEqual(
        mesaDigital ? ['comercio', 'datos', 'documentos'] : ['comercio', 'datos', 'documentos', 'liquidacion', 'accesos']);
      expect(component.numeroPasoRegistro('documentos')).toBe(3);
      expect(component.numeroPasoRegistro('liquidacion')).toBe(4);
      expect(component.numeroPasoRegistro('accesos')).toBe(5);
      expect(component.documentacionSoloConsulta).toBe(!mesaDigital);
      expect(component.mostrarCapturaFinalPendiente).toBe(!mesaDigital);
    }
  });

  it('no despliega documentación para el rol de captura', () => {
    const component = pantalla(true);
    component.seccionAbierta = null;
    component.alternarSeccion('documentos');
    expect(component.seccionAbierta).toBeNull();
  });

  it('no marca documentación concluida con avances locales sin aprobación', () => {
    const component = pantalla(true);
    spyOn(component, 'documentosNodoValidados').and.returnValue(false);
    spyOn(component, 'pasoCompletado').and.returnValue(true);
    expect(component.estadoPaso('documentos')).toBe('Pendiente de revisión');
    expect(component.pasoTerminado('documentos')).toBeFalse();
    (component.documentosNodoValidados as jasmine.Spy).and.returnValue(true);
    expect(component.estadoPaso('documentos')).toBe('Concluida');
  });

  it('no permite continuar la revisión desde un rol de captura', () => {
    const component = pantalla(true);
    const guardar = spyOn(component, 'guardarRevisionDocumentos');
    component.continuarDesdeDocumentos();
    expect(guardar).not.toHaveBeenCalled();
  });

  for (const estados of [[], ['IN_REVIEW'], ['APPROVED', 'REJECTED'], ['APPROVED', ''], ['APPROVED', 'APPROVED']]) {
    it(`habilita la captura final solamente con toda la documentación aprobada: ${JSON.stringify(estados)}`, () => {
      const component = pantalla(true, 'sucursal');
      component.nodoSeleccionado = 'sucursal';
      component.documentosProspecto = estados.map(status => ({ status }));
      spyOn<any>(component, 'buscarNodo').and.returnValue({ nivel: 'sucursal' });
      Object.defineProperty(component, 'arbol', { value: [] });

      expect(component.capturaFinalHabilitada).toBe(estados.length > 0 && estados.every(estado => estado === 'APPROVED'));

      component.cargandoDocumentosProspecto = true;
      expect(component.capturaFinalHabilitada).toBeFalse();
      component.cargandoDocumentosProspecto = false;
      component.errorDocumentosProspecto = 'No fue posible consultar los documentos';
      expect(component.capturaFinalHabilitada).toBeFalse();
    });
  }

  it('ignora clics mientras se guarda la revisión', () => {
    const component = pantalla(true);
    component.guardandoRevisionDocumentos = true;
    const guardar = spyOn(component, 'guardarRevisionDocumentos');
    component.continuarDesdeDocumentos();
    expect(guardar).not.toHaveBeenCalled();
  });
});


describe('RegistroCliente: tipo de comercio del catálogo', () => {
  function pantalla(respuesta: unknown) {
    const component = Object.create(RegistroClienteComponent.prototype);
    const getTiposComercio = jasmine.createSpy().and.returnValue(of(respuesta));
    Object.assign(component, { preRegistroService: { getTiposComercio } });
    return { component, getTiposComercio };
  }

  it('consulta el nivel recibido y resuelve el ID 8 como Sucursales Únicas', () => {
    const { component, getTiposComercio } = pantalla({ data: [
      { id: 7, name: 'Sucursales de Grupo', idAffiliationType: 5 },
      { id: 8, name: 'Sucursales Únicas', idAffiliationType: 5 },
    ] });
    let nombre: string | undefined;
    component.consultarTipoComercioCuenta({ idAffiliationLevel: 5, typeOfBusiness: 8 })
      .subscribe((valor: string) => nombre = valor);
    expect(getTiposComercio).toHaveBeenCalledOnceWith(5);
    expect(nombre).toBe('Sucursales Únicas');
  });

  it('usa cada nivel recibido y admite identificadores numéricos en texto', () => {
    const { component, getTiposComercio } = pantalla([{ id: '2', name: 'Empresa Grupo' }]);
    let nombre: string | undefined;
    component.consultarTipoComercioCuenta({ idAffiliationLevel: '4', typeOfBusiness: '2' })
      .subscribe((valor: string) => nombre = valor);
    expect(getTiposComercio).toHaveBeenCalledOnceWith(4);
    expect(nombre).toBe('Empresa Grupo');
  });

  it('no supone un tipo si el catálogo falla o no contiene el ID', () => {
    const { component, getTiposComercio } = pantalla([{ id: 7, name: 'Sucursales de Grupo' }]);
    const cuenta = { idAffiliationLevel: 5, typeOfBusiness: 8 };
    component.consultarTipoComercioCuenta(cuenta).subscribe((valor: string) => expect(valor).toBe(''));
    getTiposComercio.and.returnValue(throwError(() => new Error('Catálogo no disponible')));
    component.consultarTipoComercioCuenta(cuenta).subscribe((valor: string) => expect(valor).toBe(''));
  });

  it('presenta los campos informativos sin selectores', async () => {
    await TestBed.configureTestingModule({ imports: [StepComercioComponent] }).compileComponents();
    const fixture = TestBed.createComponent(StepComercioComponent);
    fixture.componentRef.setInput('soloInformativo', true);
    fixture.componentRef.setInput('form', new FormGroup({
      nivel: new FormControl('Sucursal'), tipoComercio: new FormControl('Sucursales Únicas'),
    }));
    fixture.detectChanges();
    const elemento: HTMLElement = fixture.nativeElement;
    expect(elemento.querySelector('select')).toBeNull();
    const tipo = elemento.querySelector<HTMLInputElement>('#tipoComercio')!;
    expect(tipo.readOnly).toBeTrue();
    expect(tipo.value).toBe('Sucursales Únicas');
    expect(elemento.querySelector<HTMLInputElement>('#nivel')!.readOnly).toBeTrue();
  });
});
