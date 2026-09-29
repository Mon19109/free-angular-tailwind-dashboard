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
      'obtenerOrden', 'obtenerCliente', 'obtenerTarjetas'
    ]);
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

    expect(service.obtenerCliente).toHaveBeenCalledWith('CLIENTE-1');
    expect(service.obtenerTarjetas).toHaveBeenCalledOnceWith('MERCHANT-9');
  });

  it('does not use clientIdentifier when the customer response has no merchanID', () => {
    service.obtenerCliente.and.returnValue(of({ rows: [{ clientIdentifier: 'CLIENTE-1' }] }));

    component.ngOnInit();

    expect(service.obtenerTarjetas).not.toHaveBeenCalled();
    expect(component.mensajeTarjetas).toContain('merchanID');
    expect(component.cargandoTarjetas).toBeFalse();
  });
});
