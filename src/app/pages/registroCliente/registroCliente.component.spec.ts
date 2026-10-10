import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { StepDocumentosComponent } from '../preRegistro/components/documentos/step-documentos.component';
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
        { id: 'datos', titulo: 'Datos Generales' },
        { id: 'documentos', titulo: 'Documentos' },
        { id: 'liquidacion', titulo: 'Cuenta de Liquidación' },
        { id: 'accesos', titulo: 'Accesos a Plataforma' }
      ]
    });
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
    Object.defineProperty(component, 'esCajaSesion', { value: false });
    Object.defineProperty(component, 'nivelSeleccionado', { value: nivel });
    Object.defineProperty(component, 'seccionesVisibles', {
      value: [{ id: 'comercio', titulo: 'Datos del Comercio' }]
    });
    return component;
  }

  it('muestra los cinco módulos para todos los roles y niveles, incluso fuera de pendientes', () => {
    for (const pendiente of [true, false]) {
      for (const nivel of ['entidad', 'sucursal', 'caja']) {
        for (const admin of [true, false]) {
          expect(pantalla(pendiente, nivel, admin).pasosVisiblesRegistro.map(paso => paso.id))
            .toEqual(['comercio', 'datos', 'documentos', 'liquidacion', 'accesos']);
        }
      }
    }
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

    expect<string | null>(component.seccionAbierta).toBe('documentos');
    expect(completar).not.toHaveBeenCalled();
    expect(alGuardar).toBeDefined();
    alGuardar!();
    expect(completar).toHaveBeenCalledWith('documentos');
    expect<string | null>(component.seccionAbierta).toBe('documentos');
    expect(component.nodoSeleccionado).toBe('entidad');
    expect(siguienteNodo).not.toHaveBeenCalled();
  });

  it('permite abrir documentos en consulta sin conceder permisos de revisión', () => {
    const component = pantalla(true);
    component.seccionAbierta = null;
    component.alternarSeccion('documentos');
    expect<string | null>(component.seccionAbierta).toBe('documentos');
    expect(component.pasoActual).toBe(3);
    expect(component.documentacionSoloConsulta).toBeTrue();
  });

  it('bloquea todas las acciones de escritura de un rol distinto al 2', () => {
    const component = pantalla(false);
    const guardar = spyOn<any>(component, 'guardarCapturaNodoActual');
    const modal = spyOn<any>(component, 'mostrarModalRegistro');
    component.documentosProspecto = [{ documentID: '1', status: 'IN_REVIEW' }];
    const documento = { numero: 1, nombre: 'INE', obligatorio: true, archivoId: '1', estatusRevision: 'IN_REVIEW' } as const;
    component.actualizarEstatusDocumento(documento, 'APPROVED');
    component.enviarNotificacionMesaDigital();
    component.guardarRevisionDocumentos();
    component.guardarLiquidacion();
    component.finalizar();
    component.registrarClienteProspecto();
    component.seleccionarArchivo({} as Event, documento);
    expect(component.documentosProspecto[0].status).toBe('IN_REVIEW');
    expect(guardar).not.toHaveBeenCalled();
    expect(modal).not.toHaveBeenCalled();
  });

  it('deshabilita los cuatro formularios en consulta y los habilita para el administrador', () => {
    for (const admin of [true, false]) {
      const component = pantalla(false, 'entidad', admin);
      const formularios = {
        comercioForm: new FormGroup({ nivel: new FormControl('Entidad'), tipoComercio: new FormControl('Empresa Grupo') }),
        datosForm: new FormGroup({ rfc: new FormControl('RFC') }),
        liquidacionForm: new FormGroup({ cuentaClabe: new FormControl('123') }),
        accesosForm: new FormGroup({ adminCorreo: new FormControl('a@b.com') })
      };
      Object.assign(component, formularios);
      (component as any).actualizarModoEdicionNodo('entidad');
      for (const form of Object.values(formularios)) expect(form.disabled).toBe(!admin);
      expect(formularios.comercioForm.controls.nivel.disabled).toBeTrue();
    }
  });

  it('mantiene Datos Generales cuando el tipo de comercio no está disponible', () => {
    const component = pantalla(false);
    Object.assign(component, {
      comercioForm: new FormGroup({ nivel: new FormControl('Entidad'), tipoComercio: new FormControl('') }),
      datosGeneralesPorTipo: { 'Empresa Grupo': ['tipoPersona', 'rfc', 'codigoPostal', 'nombreVialidad'] }
    });
    expect(component.camposDatosGenerales).toContain('tipoPersona');
    expect(component.camposDatosGenerales).toContain('codigoPostal');
  });

  it('Caja no obtiene la excepción de captura aunque consulte una entidad pendiente', () => {
    const component = Object.create(RegistroClienteComponent.prototype) as RegistroClienteComponent;
    Object.assign(component, { pendienteRevisionEdicion: true, nodeIDEdicion: 'entidad' });
    Object.defineProperties(component, {
      esMesaDigitalSesion: { value: false }, esCajaSesion: { value: true }, nivelSeleccionado: { value: 'entidad' }
    });
    expect(component.mostrarCapturaFinalPendiente).toBeFalse();
    expect(component.capturaFinalHabilitada).toBeFalse();
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


describe('Documentos: consulta sin edición', () => {
  it('muestra el archivo y su estado sin carga, validación, notificación ni guardado', async () => {
    await TestBed.configureTestingModule({ imports: [StepDocumentosComponent] }).compileComponents();
    const fixture = TestBed.createComponent(StepDocumentosComponent);
    fixture.componentRef.setInput('soloConsulta', true);
    fixture.componentRef.setInput('mostrarMesaDigital', true);
    fixture.componentRef.setInput('documentos', [{ numero: 1, nombre: 'INE', obligatorio: true, s3Key: 'archivo.pdf', estado: 'Aprobado' }]);
    const ver = spyOn(fixture.componentInstance.verArchivo, 'emit');
    const validar = spyOn(fixture.componentInstance.validarArchivo, 'emit');
    fixture.detectChanges();
    const elemento: HTMLElement = fixture.nativeElement;
    expect(elemento.textContent).toContain('Aprobado');
    expect(elemento.querySelectorAll('input').length).toBe(0);
    const botones = elemento.querySelectorAll('button');
    expect(botones.length).toBe(1);
    botones[0].click();
    expect(ver).toHaveBeenCalled();
    fixture.componentInstance.validarDocumento(fixture.componentInstance.documentos[0], 'cumple');
    expect(validar).not.toHaveBeenCalled();
  });
});
