import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { PagarLinkPagoService } from '../../services/pagarlinkpago.service';
import { PagarLinkPagoComponent } from './pagarLinkPago.component';

describe('PagarLinkPagoComponent', () => {
  let service: jasmine.SpyObj<PagarLinkPagoService>;
  let component: PagarLinkPagoComponent;

  beforeEach(() => {
    service = jasmine.createSpyObj<PagarLinkPagoService>('PagarLinkPagoService', [
      'obtenerOrden', 'obtenerCliente', 'obtenerTarjetas', 'obtenerDetalleTarjeta', 'procesarTransaccion', 'precargarUbicacion', 'obtenerBalance'
    ]);
    service.precargarUbicacion.and.returnValue(of({ latitud: '19.43', longitud: '-99.13' }));
    service.obtenerOrden.and.returnValue(of({
      order: { customerInfo: { clientIdentifier: 'CLIENTE-1', registerClient: true } }
    }));
    service.obtenerTarjetas.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ reference: 'REF-1' }) } } },
        { provide: PagarLinkPagoService, useValue: service }
      ]
    });
    component = TestBed.runInInjectionContext(() => new PagarLinkPagoComponent());
  });

  it('uses the merchanID returned by the customer service to load tokens', () => {
    service.obtenerCliente.and.returnValue(of({ rows: [{ merchanID: 'MERCHANT-9' }] }));

    component.ngOnInit();

    expect(service.precargarUbicacion).toHaveBeenCalledTimes(1);
    expect(component.latitud).toBe('19.43');
    expect(component.longitud).toBe('-99.13');
    expect(service.obtenerCliente).toHaveBeenCalledWith('CLIENTE-1');
    expect(service.obtenerTarjetas).toHaveBeenCalledOnceWith('MERCHANT-9');
  });

  it('loads the balance with the order sirioID when the page loads', () => {
    service.obtenerOrden.and.returnValue(of({ rows: { order: { sirioID: 'SIRIO-9' } } }));
    service.obtenerBalance.and.returnValue(of({ rows: { availableBalance: 100 } }));

    component.ngOnInit();

    expect(service.obtenerBalance).toHaveBeenCalledOnceWith('SIRIO-9');
    expect(component.balance).toEqual({ availableBalance: 100 });
  });

  it('does not use clientIdentifier when the customer response has no merchanID', () => {
    service.obtenerCliente.and.returnValue(of({ rows: [{ clientIdentifier: 'CLIENTE-1' }] }));

    component.ngOnInit();

    expect(service.obtenerTarjetas).not.toHaveBeenCalled();
    expect(component.mensajeTarjetas).toContain('merchanID');
    expect(component.cargandoTarjetas).toBeFalse();
  });

  it('shows the card number returned for each saved card', () => {
    service.obtenerCliente.and.returnValue(of({ merchanID: 'MERCHANT-9' }));
    service.obtenerTarjetas.and.returnValue(of({ rows: [
      { cardToken: 'TOKEN-1', card: '520416******0691', maskedPan: '************1234' },
      { cardToken: 'TOKEN-2', maskedPan: '************5678' }
    ] }));

    component.ngOnInit();

    expect(component.tarjetasGuardadas).toEqual([
      { token: 'TOKEN-1', etiqueta: '520416******0691' },
      { token: 'TOKEN-2', etiqueta: '************5678' }
    ]);
  });

  it('fills the saved card form from getTokenDetail and keeps CVV editable', () => {
    service.obtenerCliente.and.returnValue(of({ merchanID: 'MERCHANT-9' }));
    service.obtenerTarjetas.and.returnValue(of({ rows: [
      { cardToken: 'TOKEN-1', card: '520416******0691' }
    ] }));
    service.obtenerDetalleTarjeta.and.returnValue(of({ rows: {
      paymentInstrument: {
        card: '5204166074560691', name: 'Monica Aviles', expirationDate: '12-29',
        address: 'Enramada 123', city: 'Mex', postalCode: '57440', locality: 'Estado de Mexico', country: 'Mexico'
      }
    } }));

    component.ngOnInit();
    component.seleccionarTarjeta({ target: { value: 'TOKEN-1' } } as unknown as Event);

    expect(service.obtenerDetalleTarjeta).toHaveBeenCalledOnceWith('MERCHANT-9', 'TOKEN-1');
    expect(component.formulario.controls.nameCard.value).toBe('Monica Aviles');
    expect(component.formulario.controls.numCard.value).toBe('5204-1660-7456-0691');
    expect(component.formulario.controls.vencimiento.value).toBe('12/29');
    expect(component.formulario.controls.address.value).toBe('Enramada 123');
    expect(component.formulario.controls.ciudad.value).toBe('Mex');
    expect(component.formulario.controls.cp.value).toBe('57440');
    expect(component.formulario.controls.estado.value).toBe('Estado de Mexico');
    expect(component.formulario.controls.pais.value).toBe('Mexico');
    expect(component.formulario.controls.numCard.disabled).toBeTrue();
    expect(component.formulario.controls.ccv.enabled).toBeTrue();
    expect(component.tarjetasGuardadas[0].etiqueta).toBe('520416******0691');

    service.procesarTransaccion.and.returnValue(of({ success: true }));
    component.formulario.controls.ccv.setValue('123');
    component.formulario.controls.terminos.setValue(true);
    component.procesarPago();

    const payload = service.procesarTransaccion.calls.mostRecent().args[0] as any;
    expect(payload.cardData).toEqual(jasmine.objectContaining({
      cardToken: 'TOKEN-1', cardholderName: 'Monica Aviles', expirationMonth: '12', expirationYear: '29'
    }));
  });

  it('shows the transaction rejection in the payment error modal', () => {
    service.obtenerCliente.and.returnValue(of({ merchanID: 'MERCHANT-9' }));
    service.procesarTransaccion.and.returnValue(of({ success: false, message: 'Pago rechazado' }));
    component.ngOnInit();
    component.formulario.patchValue({
      nameCard: 'Ana Lopez', numCard: '4111 1111 1111 1111', vencimiento: '12/29',
      ccv: '123', pais: 'Mexico', cp: '12345', terminos: true
    });

    component.procesarPago();

    expect(component.errorPago).toBe('Pago rechazado');
    expect(component.mensajePago).toBe('');
    component.cerrarErrorPago();
    expect(component.errorPago).toBe('');
  });
});
