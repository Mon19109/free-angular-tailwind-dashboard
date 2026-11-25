import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { OrdenPagoComponent } from './OrdenPago.component';

describe('Orden de pago: carga con sesión pública', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrdenPagoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).actualizarSesion({
      success: true,
      authenticated: true,
      expiresAt: Date.now() + 60000,
      usuario: { idRol: 2, userName: 'usuario', cuenta: 'cuenta-publica' }
    });
  });

  afterEach(() => http.verify());

  function prepararOrden() {
    const fixture = TestBed.createComponent(OrdenPagoComponent);
    fixture.detectChanges();
    http.expectOne('/api/orden-pago/cuentas').flush({ accounts: [{ idSirio: 'ORIGEN-1', name: 'Cuenta emisión' }] });
    http.expectOne('/api/orden-pago/contactos').flush({ contacts: [{
      fullName: 'Beneficiario', accountNumber: '123456789012345678',
      cardNumberMask: '****5678', idInstitution: '40903', nameInstitution: 'Banco'
    }] });
    const component = fixture.componentInstance;
    component.formulario.patchValue({ cuentaOr: 'ORIGEN-1', cuentaD: component.obtenerValorBeneficiario(component.beneficiarios[0]), importe: '100.00' });
    component.obtenerSaldo();
    return component;
  }

  it('envía y reenvía el token usando el GUID de sesión del servidor', () => {
    const component = prepararOrden();
    http.expectOne('/api/orden-pago/saldo/ORIGEN-1').flush({ balance: '500.00' });
    component.finalizar();
    const envio = http.expectOne('/api/orden-pago/enviar-token');
    expect(envio.request.body).toEqual({});
    expect(envio.request.withCredentials).toBeTrue();
    expect(envio.request.headers.get('X-Portal-Request')).toBe('1');
    envio.flush({ success: true });
    expect(component.mostrarModalToken).toBeTrue();
    component.reenviarToken();
    component.reenviarToken();
    http.expectOne('/api/orden-pago/enviar-token').flush({ success: true });
    expect(component.reenviandoToken).toBeFalse();
  });

  it('solo envía SPEI después de confirmar la validación del token', () => {
    const component = prepararOrden();
    http.expectOne('/api/orden-pago/saldo/ORIGEN-1').flush({ balance: 500 });
    component.finalizar();
    http.expectOne('/api/orden-pago/enviar-token').flush({ success: true });
    component.token = '123456';
    component.validarToken(); component.validarToken();
    const validacion = http.expectOne('/api/orden-pago/validar-token');
    expect(validacion.request.body).toEqual({ token: '123456' });
    expect(validacion.request.headers.get('X-Portal-Request')).toBe('1');
    http.expectNone('/api/orden-pago/spei');
    validacion.flush({ success: true });
    const pago = http.expectOne('/api/orden-pago/spei');
    expect(pago.request.headers.get('X-Portal-Request')).toBe('1');
    expect(pago.request.withCredentials).toBeTrue();
    pago.flush({ code: '00' });
    expect(component.comprobanteSpei).toBeTruthy();
    expect(component.payloadPendiente).toBeNull();
  });

  it('rechaza códigos incompletos y no libera pagos con una validación fallida', () => {
    const component = prepararOrden();
    http.expectOne('/api/orden-pago/saldo/ORIGEN-1').flush({ balance: 500 });
    component.finalizar();
    http.expectOne('/api/orden-pago/enviar-token').flush({ success: true });
    component.token = '123'; component.validarToken();
    http.expectNone('/api/orden-pago/validar-token');
    expect(component.tokenError).toContain('6 dígitos');
    component.token = '123456'; component.validarToken();
    http.expectOne('/api/orden-pago/validar-token').flush({ success: false });
    http.expectNone('/api/orden-pago/spei');
    expect(component.validandoToken).toBeFalse();
    expect(component.mostrarModalToken).toBeTrue();
  });

  it('no confirma el envío del token con una respuesta ambigua', () => {
    const component = prepararOrden();
    http.expectOne('/api/orden-pago/saldo/ORIGEN-1').flush({ balance: 500 });
    component.finalizar();
    http.expectOne('/api/orden-pago/enviar-token').flush({ code: '00' });
    expect(component.mostrarModalToken).toBeFalse();
    expect(component.mensajeEnvio).toContain('No fue posible enviar');
    expect(component.finalizandoEnvio).toBeFalse();
  });

  it('bloquea la confirmación mientras carga el saldo o si la consulta falla', () => {
    const component = prepararOrden();
    component.finalizar();
    http.expectNone('/api/orden-pago/enviar-token');
    expect(component.mensajeValidacionOrden).toContain('Espera');
    http.expectOne('/api/orden-pago/saldo/ORIGEN-1').flush({}, { status: 503, statusText: 'Service Unavailable' });
    component.finalizar();
    http.expectNone('/api/orden-pago/enviar-token');
    expect(component.errorSaldo).toContain('No fue posible consultar');
    expect(component.saldoConsultado).toBeFalse();
    expect(component.cargandoSaldo).toBeFalse();
  });

  it('cancela el saldo anterior al cambiar de cuenta', () => {
    const component = prepararOrden();
    const anterior = http.expectOne('/api/orden-pago/saldo/ORIGEN-1');
    component.formulario.patchValue({ cuentaOr: 'ORIGEN-2' });
    component.obtenerSaldo();
    expect(anterior.cancelled).toBeTrue();
    http.expectOne('/api/orden-pago/saldo/ORIGEN-2').flush({ balance: 250 });
    expect(component.saldo).toBe(250);
    expect(component.saldoConsultado).toBeTrue();
    expect(component.cargandoSaldo).toBeFalse();
  });

  it('consulta ambos catálogos sin IDs privados y muestra las opciones recibidas', () => {
    const fixture = TestBed.createComponent(OrdenPagoComponent);
    fixture.detectChanges();

    const cuentas = http.expectOne('/api/orden-pago/cuentas');
    const contactos = http.expectOne('/api/orden-pago/contactos');
    for (const request of [cuentas, contactos]) {
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys()).toEqual([]);
      expect(request.request.withCredentials).toBeTrue();
    }
    cuentas.flush({ accounts: [
      { idSirio: 'ORIGEN-1', name: 'Cuenta emisión' },
      { idSirio: 'RESERVA', name: 'Cuenta reserva' }
    ] });
    contactos.flush({ contacts: [{
      fullName: 'Beneficiario ejemplo', accountNumber: '123456789012345678',
      cardNumberMask: '****5678', idInstitution: '40903', nameInstitution: 'Banco ejemplo'
    }] });
    fixture.detectChanges();

    const origen = fixture.nativeElement.querySelector('#cuentaOr') as HTMLSelectElement;
    const destino = fixture.nativeElement.querySelector('#cuentaD') as HTMLSelectElement;
    expect(origen.options.length).toBe(2);
    expect(origen.options[1].value).toBe('ORIGEN-1');
    expect(origen.options[1].textContent).toContain('Cuenta emisión');
    expect(destino.options.length).toBe(2);
    expect(destino.options[1].textContent).toContain('Beneficiario ejemplo');

    destino.value = destino.options[1].value;
    destino.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.formulario.value.accountNumber).toBe('123456789012345678');
    expect(fixture.componentInstance.formulario.value.idInstitution).toBe('40903');
  });

  it('carga los contactos aunque falle la consulta de cuentas', () => {
    const fixture = TestBed.createComponent(OrdenPagoComponent);
    fixture.detectChanges();
    http.expectOne('/api/orden-pago/cuentas').flush({}, { status: 503, statusText: 'Service Unavailable' });
    http.expectOne('/api/orden-pago/contactos').flush({ contacts: [{ fullName: 'Beneficiario', accountNumber: '123456789012345678' }] });
    fixture.detectChanges();
    expect(fixture.componentInstance.beneficiarios.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar las cuentas ordenantes.');
  });

  it('carga cuentas aunque fallen los contactos y distingue el error de una lista vacía', () => {
    const fixture = TestBed.createComponent(OrdenPagoComponent);
    fixture.detectChanges();
    http.expectOne('/api/orden-pago/cuentas').flush({ accounts: [{ idSirio: 'ORIGEN-1', name: 'Cuenta emisión' }] });
    http.expectOne('/api/orden-pago/contactos').flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.cuentas.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar los contactos beneficiarios.');
    expect(fixture.nativeElement.textContent).not.toContain('Sin beneficiarios disponibles');
  });
});
