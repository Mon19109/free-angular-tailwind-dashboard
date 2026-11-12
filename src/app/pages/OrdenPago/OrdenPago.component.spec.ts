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
});
