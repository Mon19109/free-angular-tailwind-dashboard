import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { PreRegistroComponent } from './preRegistro.component';
import { StepAfiliacionComponent } from './components/afiliacion/step-afiliacion.component';
import { RegimenFiscalService } from '../../services/regimen-fiscal.service';
import { environment } from '../../environments/environments';

describe('Preregistro público: validación inicial de afiliación', () => {
  let component: PreRegistroComponent;
  let http: HttpTestingController;
  const url = environment.preregistroBff.validarAfiliacionUrl;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StepAfiliacionComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ChangeDetectorRef, useValue: { detectChanges() {} } },
      { provide: RegimenFiscalService, useValue: { getAllOptions: () => of([]) } }
    ] });
    component = TestBed.runInInjectionContext(() => new PreRegistroComponent());
    http = TestBed.inject(HttpTestingController);
    spyOn<any>(component, 'guardarBorradorSilencioso');
    spyOn(component, 'irAlPaso');
  });
  afterEach(() => http.verify());

  it('muestra el predeterminado y permite editarlo o borrarlo desde el campo', () => {
    const fixture = TestBed.createComponent(StepAfiliacionComponent);
    fixture.componentInstance.form = component.afiliacionForm;
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#afiliacion');
    expect(input.value).toBe('2501112');
    expect(fixture.nativeElement.textContent).toContain('correo electrónico');
    for (const value of ['0012345', '']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.afiliacionForm.controls.afiliacion.value).toBe(value);
    }
    component.continuarAfiliacion();
    http.expectNone(url);
    expect(component.afiliacionForm.invalid).toBeTrue();
  });

  for (const value of ['2501112', '0012345']) {
    it(`envía ${value} sin transformar y solo avanza con comprobante confirmado`, () => {
      component.afiliacionForm.controls.afiliacion.setValue(value);
      component.continuarAfiliacion();
      const request = http.expectOne(url);
      expect(request.request.body).toEqual({ affiliationNumber: value });
      expect(request.request.headers.has('Authorization')).toBeFalse();
      expect(component.irAlPaso).not.toHaveBeenCalled();
      request.flush({ success: true, comprobante: 'a'.repeat(64) });
      expect(component.irAlPaso).toHaveBeenCalledWith(6);
      expect(component.afiliacionForm.controls.afiliacion.value).toBe(value);
    });
  }

  for (const status of [502, 503, 504]) {
    it(`conserva el valor editado tras ${status} y permite reintentar`, () => {
      component.afiliacionForm.controls.afiliacion.setValue('7654321');
      component.continuarAfiliacion();
      http.expectOne(url).flush({ success: false }, { status, statusText: 'Unavailable' });
      expect(component.afiliacionForm.controls.afiliacion.value).toBe('7654321');
      expect(component.errorAfiliacion).toContain('no está disponible temporalmente');
      expect(component.validandoAfiliacion).toBeFalse();
      expect(component.irAlPaso).not.toHaveBeenCalled();
      component.continuarAfiliacion();
      const retry = http.expectOne(url);
      expect(retry.request.body).toEqual({ affiliationNumber: '7654321' });
      retry.flush({ success: true, comprobante: 'b'.repeat(64) });
      expect(component.irAlPaso).toHaveBeenCalledWith(6);
    });
  }

  it('muestra el rechazo del BFF sin avanzar ni restablecer el número', () => {
    component.afiliacionForm.controls.afiliacion.setValue('9876543');
    component.continuarAfiliacion();
    http.expectOne(url).flush({ success: false, code: 'AFILIACION_REJECTED', message: 'Afiliación no encontrada.' },
      { status: 422, statusText: 'Unprocessable Entity' });
    expect(component.errorAfiliacion).toBe('Afiliación no encontrada.');
    expect(component.afiliacionForm.controls.afiliacion.value).toBe('9876543');
    expect(component.irAlPaso).not.toHaveBeenCalled();
  });

  it('no avanza con respuestas fallidas o sin comprobante', () => {
    for (const response of [{ success: false, message: 'Afiliación rechazada.' }, { success: true }]) {
      component.continuarAfiliacion();
      http.expectOne(url).flush(response);
      expect(component.irAlPaso).not.toHaveBeenCalled();
      expect(component.errorAfiliacion).not.toBe('');
    }
  });

  it('descarta la respuesta si el usuario cambió de número durante la validación', () => {
    component.continuarAfiliacion();
    const request = http.expectOne(url);
    component.afiliacionForm.controls.afiliacion.setValue('1234567');
    request.flush({ success: true, comprobante: 'c'.repeat(64) });
    expect(component.irAlPaso).not.toHaveBeenCalled();
    expect(component.afiliacionForm.controls.afiliacion.value).toBe('1234567');
  });
});
