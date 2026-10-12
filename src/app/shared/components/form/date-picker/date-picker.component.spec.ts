import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Instance } from 'flatpickr/dist/types/instance';
import { DatePickerComponent } from './date-picker.component';

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<DatePickerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DatePickerComponent] });
    fixture = TestBed.createComponent(DatePickerComponent);
    fixture.componentInstance.id = 'fechaPrueba';
  });

  function calendario(): Instance {
    return (fixture.nativeElement.querySelector('input') as HTMLInputElement & { _flatpickr: Instance })._flatpickr;
  }

  it('muestra meses y días en español y emite solo la fecha cuando se desactiva la hora', () => {
    fixture.componentInstance.locale = 'es';
    fixture.componentInstance.enableTime = false;
    const cambio = spyOn(fixture.componentInstance.dateChange, 'emit');
    fixture.detectChanges();
    const instance = calendario();

    expect(instance.l10n.months.longhand[0]).toBe('Enero');
    expect(instance.l10n.weekdays.longhand[1]).toBe('Lunes');
    expect(instance.config.disableMobile).toBeTrue();
    expect(instance.calendarContainer.querySelector('.flatpickr-time')).toBeNull();
    instance.setDate('2026-10-12', true);
    expect(cambio).toHaveBeenCalledWith(jasmine.objectContaining({ dateStr: '2026-10-12' }));
    expect(instance.input.value).toBe('2026-10-12');
  });

  it('conserva el formato de fecha y hora para los selectores que no desactivan la hora', () => {
    const cambio = spyOn(fixture.componentInstance.dateChange, 'emit');
    fixture.detectChanges();
    const instance = calendario();
    expect(instance.config.enableTime).toBeTrue();
    instance.setDate('2026-10-12 14:30', true);
    expect(cambio).toHaveBeenCalledWith(jasmine.objectContaining({ dateStr: '2026-10-12 14:30' }));
  });
});
