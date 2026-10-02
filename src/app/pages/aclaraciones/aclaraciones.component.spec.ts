import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AclaracionesService } from '../../services/aclaraciones.servises';
import { AclaracionesComponent } from './aclaraciones.component';

describe('Monto de Aclaraciones', () => {
  let component: AclaracionesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: AclaracionesService, useValue: { obtenerMotivos: () => of([]) } }
      ]
    });
    component = TestBed.runInInjectionContext(() => new AclaracionesComponent());
    component.transaccion = { amount: 10 };
    component.form.controls.tipo.setValue('DP');
    component.cambiarTipo();
  });

  it('inserta el punto decimal automáticamente y limita el monto al de la transacción', () => {
    component.form.controls.monto.setValue('123');
    component.formatearMonto();
    expect(component.form.controls.monto.value).toBe('1.23');

    component.form.controls.monto.setValue('1234');
    component.formatearMonto();
    expect(component.form.controls.monto.value).toBe('10.00');

    component.form.controls.monto.setValue('a12.3x');
    component.formatearMonto();
    expect(component.form.controls.monto.value).toBe('1.23');
  });

  it('permite borrar los centavos capturados', () => {
    component.form.controls.monto.setValue('1.23');
    const preventDefault = jasmine.createSpy('preventDefault');
    component.restringirTeclaMonto({
      key: 'Backspace', preventDefault,
      target: { value: '1.23', selectionStart: 4, selectionEnd: 4 }
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.form.controls.monto.value).toBe('0.12');
  });
});
