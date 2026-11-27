import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransaccionesEmisionComponent } from './transaccionesEmision.component';

describe('Selector de entidades de Transacciones Emisión', () => {
  let fixture: ComponentFixture<TransaccionesEmisionComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransaccionesEmisionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TransaccionesEmisionComponent);
    fixture.detectChanges();
    http.expectOne('/api/transacciones-emision/tipos-operacion').flush([]);
    http.expectOne('/api/transacciones-emision/status').flush([]);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  for (const formato of ['lista', 'rows', 'content']) {
    it(`lista entidades activas con tipo numérico o texto en ${formato}`, () => {
      const entidades = [
        { sirioId: 'E1', name: 'Entidad uno', type: 4, active: true },
        { sirioId: 'E2', name: 'Entidad dos', type: '4', active: true },
        { sirioId: 'INACTIVA', name: 'Inactiva', type: 4, active: false },
        { bundle: 'SUCURSAL', bussinesName: 'Sucursal', type: 5, active: true },
        { bundle: 'CAJA', bussinesName: 'Caja', type: 6, active: true },
        { bundle: 'CAJA-INACTIVA', bussinesName: 'Caja inactiva', type: 6, active: false }
      ];
      http.expectOne('/api/transacciones-emision/cuentas')
        .flush(formato === 'lista' ? entidades : { [formato]: entidades });
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select[name="idEntidad"]') as HTMLSelectElement;
      expect(Array.from(select.options).map(option => option.value)).toEqual(['', 'E1', 'E2', 'SUCURSAL', 'CAJA']);
      expect(select.options[2].textContent).toContain('Entidad dos');
      expect(select.options[3].textContent).toContain('Sucursal');
      expect(select.options[4].textContent).toContain('Caja');
      select.value = 'E2';
      select.dispatchEvent(new Event('change'));
      expect(fixture.componentInstance.filtros.idEntidad).toBe('E2');
    });
  }

  it('muestra el error de carga en la pantalla', () => {
    http.expectOne('/api/transacciones-emision/cuentas')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.cuentas).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar las entidades.');
  });
});
