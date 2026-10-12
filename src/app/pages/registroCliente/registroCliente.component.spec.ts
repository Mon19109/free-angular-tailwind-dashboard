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

  it('mantiene liquidación y accesos deshabilitados también para el administrador', () => {
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
      expect(formularios.comercioForm.disabled).toBe(!admin);
      expect(formularios.datosForm.disabled).toBe(!admin);
      expect(formularios.liquidacionForm.disabled).toBeTrue();
      expect(formularios.accesosForm.disabled).toBeTrue();
      expect(formularios.comercioForm.controls.nivel.disabled).toBeTrue();
    }
  });

  for (const pendiente of [true, false]) {
    it(`el rol 2 no guarda liquidación ni accesos, pendiente=${pendiente}`, () => {
      const component = pantalla(pendiente, 'entidad', true);
      const guardar = spyOn<any>(component, 'guardarCapturaNodoActual');
      component.guardarLiquidacion();
      component.completarPaso('liquidacion');
      component.completarPaso('accesos');
      expect(guardar).not.toHaveBeenCalled();
      expect(component.capturaFinalHabilitada).toBeFalse();
    });
  }

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


describe('RegistroCliente: tipo de comercio por nivel del GET', () => {
  for (const [nivel, esperado] of [
    [3, 'Empresa Holding'], [4, 'Empresa Grupo'],
    [5, 'Sucursales de Grupo'], [6, 'Cuenta Terminal'],
  ] as const) {
    it(`pinta ${esperado} únicamente por idAffiliationLevel ${nivel}`, () => {
      const component = Object.create(RegistroClienteComponent.prototype);
      for (const typeOfBusiness of [0, 8, null, undefined]) {
        const cuenta = component.registroCuentaDesdeRespuesta({
          success: true, entityInfo: { idAffiliationLevel: nivel, typeOfBusiness },
        });
        component.consultarTipoComercioCuenta(cuenta)
          .subscribe((valor: string) => expect(valor).toBe(esperado));
      }
    });
  }

  it('lee niveles anidados, numéricos en texto y la llave alternativa', () => {
    const component = Object.create(RegistroClienteComponent.prototype);
    for (const cuenta of [
      { data: { entityInfo: { idAffiliationLevel: '3' } } },
      { idAffilationLevel: '3' },
    ]) {
      component.consultarTipoComercioCuenta(cuenta)
        .subscribe((valor: string) => expect(valor).toBe('Empresa Holding'));
    }
  });

  it('no supone un tipo cuando no hay un nivel reconocido', () => {
    const component = Object.create(RegistroClienteComponent.prototype);
    for (const idAffiliationLevel of [undefined, null, '', 0, 99]) {
      component.consultarTipoComercioCuenta({ idAffiliationLevel })
        .subscribe((valor: string) => expect(valor).toBe(''));
    }
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
  it('conserva la tabla de Mesa Digital y permite ver, con la validación deshabilitada', async () => {
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
    expect(elemento.querySelector('.mesa-table')).not.toBeNull();
    expect(elemento.querySelector('.mesa-results')).not.toBeNull();
    expect(elemento.querySelector('.mesa-register-action')).toBeNull();
    expect(botones.length).toBe(3);
    expect(botones[1].disabled).toBeTrue();
    expect(botones[2].disabled).toBeTrue();
    botones[0].click();
    expect(ver).toHaveBeenCalled();
    fixture.componentInstance.validarDocumento(fixture.componentInstance.documentos[0], 'cumple');
    expect(validar).not.toHaveBeenCalled();
  });
});


describe('RegistroCliente: subir documentos faltantes', () => {
  function pantalla() {
    const component = Object.create(RegistroClienteComponent.prototype);
    const subirDocumentos = jasmine.createSpy().and.returnValue(of([{ success: true }]));
    const consultarDocumentosProspecto = jasmine.createSpy();
    Object.assign(component, {
      commerceID: 'comercio-actual', nodoSeleccionado: 'nodo-actual', documentosProspecto: [],
      documentos: [
        { numero: 1, nombre: 'Comprobante de domicilio', obligatorio: true },
        { numero: 2, nombre: 'Acta Constitutiva', obligatorio: true },
      ],
      preregistroDocumentosService: { subirDocumentos }, consultarDocumentosProspecto,
    });
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: true, configurable: true });
    return { component, subirDocumentos, consultarDocumentosProspecto };
  }

  it('sube un documento cuando la consulta está vacía y vuelve a consultar', () => {
    const { component, subirDocumentos, consultarDocumentosProspecto } = pantalla();
    const archivo = new File(['pdf'], 'domicilio.pdf', { type: 'application/pdf' });
    component.subirDocumentoFaltante({ archivo, documento: component.documentos[0] });
    expect(subirDocumentos).toHaveBeenCalledWith([
      { guid: 'comercio-actual', fileName: 'comercio-actual_COMP_DOM.pdf', file: archivo },
    ], jasmine.any(String), { crearDirectorio: true });
    expect(consultarDocumentosProspecto).toHaveBeenCalledTimes(1);
    expect(component.subiendoDocumento).toBeFalse();
  });

  it('excluye del selector el acta existente con sufijo ACTA_CONS', () => {
    const { component } = pantalla();
    component.documentosProspecto = [{ s3Key: 'carpeta/comercio_ACTA_CONS.pdf' }];
    expect(component.documentosDisponiblesParaSubir.map((doc: { numero: number }) => doc.numero)).toEqual([1]);
  });

  it('no envía archivos con formato incorrecto ni permite cargas en solo consulta', () => {
    const { component, subirDocumentos } = pantalla();
    component.subirDocumentoFaltante({ archivo: new File(['x'], 'archivo.exe'), documento: component.documentos[0] });
    expect(subirDocumentos).not.toHaveBeenCalled();
    expect(component.mensajeCargaDocumento).toContain('PDF');
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: false });
    component.subirDocumentoFaltante({ archivo: new File(['pdf'], 'archivo.pdf'), documento: component.documentos[0] });
    expect(subirDocumentos).not.toHaveBeenCalled();
  });

  it('muestra el error de subida y permite reintentar', () => {
    const { component, subirDocumentos, consultarDocumentosProspecto } = pantalla();
    for (const respuesta of [of([{ success: false }]), throwError(() => new Error('Fallo'))]) {
      subirDocumentos.and.returnValue(respuesta);
      component.subirDocumentoFaltante({ archivo: new File(['pdf'], 'archivo.pdf'), documento: component.documentos[0] });
      expect(component.mensajeCargaDocumento).toContain('No fue posible');
      expect(component.subiendoDocumento).toBeFalse();
      expect(consultarDocumentosProspecto).not.toHaveBeenCalled();
    }
  });
});

describe('RegistroCliente: actualización del nodo seleccionado', () => {
  function pantalla(mesaDigital = true) {
    const component = Object.create(RegistroClienteComponent.prototype);
    const actualizar = jasmine.createSpy().and.returnValue(of(undefined));
    const nodo = { id: 'nodo-hijo', nombre: 'Antes' };
    Object.assign(component, {
      nodeIDEdicion: 'raiz', nodoSeleccionado: 'nodo-hijo',
      cuentaNodoActual: { commerceGuid: 'guid-hijo', nameCommerce: 'Antes', typeOfBusiness: 0, contacts: [] },
      datosForm: new FormGroup({ nombreComercial: new FormControl('Antes'), rfc: new FormControl('RFC') }),
      datosPorNodo: {}, contextoSeleccionado: {}, merchantUpdateDataService: { actualizar },
      actualizarIdentificadoresDesdeCuenta: jasmine.createSpy(), actualizarModoEdicionNodo: jasmine.createSpy(),
      buscarNodo: () => nodo,
    });
    Object.defineProperty(component, 'arbol', { value: [] });
    Object.defineProperty(component, 'esMesaDigitalSesion', { value: mesaDigital });
    return { component, actualizar, nodo };
  }

  for (const pendienteRevisionEdicion of [true, false]) {
    it(`impide editar y enviar datos generales con otro rol, pendiente=${pendienteRevisionEdicion}`, () => {
      const { component, actualizar } = pantalla(false);
      component.pendienteRevisionEdicion = pendienteRevisionEdicion;
      component.datosForm.disable();
      component.editarDatosNodo();
      expect(component.datosForm.disabled).toBeTrue();
      expect(component.puedeEditarDatosNodo).toBeFalse();
      component.editandoDatosNodo = true;
      component.datosForm.patchValue({ nombreComercial: 'No permitido' });
      component.guardarDatosNodo();
      expect(actualizar).not.toHaveBeenCalled();
    });
  }

  it('envía el GUID del hijo consultado y conserva los datos sin modificar', () => {
    const { component, actualizar, nodo } = pantalla();
    component.editarDatosNodo();
    component.datosForm.patchValue({ nombreComercial: 'Después' });
    component.guardarDatosNodo();
    expect(actualizar).toHaveBeenCalledWith(jasmine.objectContaining({
      commerceGuid: 'guid-hijo', nameCommerce: 'Después', typeOfBusiness: 0, contacts: [],
    }));
    expect(nodo.nombre).toBe('Después');
    expect(component.editandoDatosNodo).toBeTrue();
    expect(component.guardandoDatosNodo).toBeFalse();
  });

  it('cancelar restaura el formulario y no envía el PUT', () => {
    const { component, actualizar } = pantalla();
    component.editarDatosNodo();
    component.datosForm.patchValue({ nombreComercial: 'No guardar' });
    component.cancelarEdicionDatosNodo();
    expect(component.datosForm.getRawValue().nombreComercial).toBe('Antes');
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('conserva los cambios para reintentar después de un error', () => {
    const { component, actualizar } = pantalla();
    actualizar.and.returnValue(throwError(() => new Error('No actualizado')));
    component.editarDatosNodo();
    component.datosForm.patchValue({ nombreComercial: 'Después' });
    component.guardarDatosNodo();
    expect(component.editandoDatosNodo).toBeTrue();
    expect(component.datosForm.getRawValue().nombreComercial).toBe('Después');
    expect(component.guardandoDatosNodo).toBeFalse();
    expect(component.mensajeActualizacionDatos).toBe('No actualizado');
  });

  it('impide cambiar de nodo durante el PUT', () => {
    const { component } = pantalla();
    component.guardandoDatosNodo = true;
    component.seleccionarNodo({ id: 'otro', nombre: 'Otro', nivel: 'entidad' });
    expect(component.nodoSeleccionado).toBe('nodo-hijo');
  });
});


describe('RegistroCliente: localidad del representante', () => {
  it('completa municipio y estado usando la localidad exacta del contacto', () => {
    const component = Object.create(RegistroClienteComponent.prototype) as any;
    Object.assign(component, {
      consultaCuentaActual: 1,
      localidadesService: { obtenerPorCodigoPostal: jasmine.createSpy().and.returnValue(of([
        { idLocalidad: 'otra', municipio: 'Otro municipio', estado: 'Otro estado' },
        { idLocalidad: '15421456334', colonia: 'Centro', municipio: 'Municipio esperado', estado: 'Estado esperado' }
      ])) },
      datosForm: new FormGroup({
        locationIDRepresentante: new FormControl('15421456334'),
        coloniaRepresentante: new FormControl(''),
        municipioRepresentante: new FormControl(''),
        estadoRepresentante: new FormControl('')
      })
    });
    component.consultarLocalidadRepresentante({ postalCode: '12345', idLocation: '15421456334' });
    expect(component.datosForm.getRawValue()).toEqual({
      locationIDRepresentante: '15421456334', coloniaRepresentante: 'Centro',
      municipioRepresentante: 'Municipio esperado', estadoRepresentante: 'Estado esperado'
    });
  });
});
