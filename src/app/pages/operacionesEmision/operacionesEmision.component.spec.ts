import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperacionesEmisionComponent } from './operacionesEmision.component';

describe('Selector de entidades de Operaciones Emisión', () => {
  let fixture: ComponentFixture<OperacionesEmisionComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperacionesEmisionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OperacionesEmisionComponent);
    fixture.detectChanges();
    http.expectOne('/api/operaciones-emision/tipos-operacion').flush({ catOperationTypes: [] });
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('carga entidades desde getEntityLevels y conserva la cuenta al seleccionar', () => {
    const request = http.expectOne('/api/transacciones-emision/cuentas');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ rows: [
      { account: 'CUENTA-1', name: 'Entidad uno', type: '4', active: true },
      { bundle: 'CUENTA-2', businessName: 'Entidad dos', type: 4, active: true },
      { idSirio: 'SIRIO-3', name: 'Entidad tres', type: 4, active: true },
      { account: 'INACTIVA', type: 4, active: false },
      { account: 'SUCURSAL', type: 5, active: true }
    ] });
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select[formControlName="cuenta"]') as HTMLSelectElement;
    expect(Array.from(select.options).map(option => option.value)).toEqual(['', 'CUENTA-1', 'CUENTA-2', 'SIRIO-3']);
    expect(select.options[2].textContent).toContain('Entidad dos');
    select.value = 'CUENTA-2';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.formulario.getRawValue().cuenta).toBe('CUENTA-2');
    http.expectNone('/api/operaciones-emision/cuentas');
    http.expectNone('/api/operaciones-emision/cuentas-concentradoras');
  });

  it('muestra el error de carga de entidades', () => {
    http.expectOne('/api/transacciones-emision/cuentas')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.entidades).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('No se pudieron cargar las entidades.');
  });
});
