import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RecuperarCuentaService } from '../../services/recuperarCuenta.service';
import { RecuperarCuentaComponent } from './recuperarCuenta.component';

describe('RecuperarCuentaComponent', () => {
  let fixture: ComponentFixture<RecuperarCuentaComponent>;
  let component: RecuperarCuentaComponent;
  let service: jasmine.SpyObj<RecuperarCuentaService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<RecuperarCuentaService>('RecuperarCuentaService', ['recuperarCuenta']);
    await TestBed.configureTestingModule({
      imports: [RecuperarCuentaComponent],
      providers: [
        { provide: RecuperarCuentaService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ validate: 'TOKEN' }) } } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']) }
      ]
    }).overrideComponent(RecuperarCuentaComponent, { set: { styles: [], styleUrls: [] } }).compileComponents();
    fixture = TestBed.createComponent(RecuperarCuentaComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    component.recuperarForm.patchValue({ contrasena: 'Abcdef12345!', contrasenaCon: 'Abcdef12345!' });
  });

  it('prioriza error.message y lo muestra solo en el popup al responder success false', () => {
    service.recuperarCuenta.and.returnValue(of({ success: false, message: 'Mensaje general', error: { message: 'El enlace ha expirado.' } }));
    component.recuperarCuenta();
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('[role="alertdialog"]');
    expect(popup.textContent).toContain('El enlace ha expirado.');
    expect(fixture.nativeElement.querySelector('.recovery-status')).toBeNull();
    expect(component.enviando).toBeFalse();
    expect(component.mostrarModalExito).toBeFalse();
    expect(component.recuperarForm.controls.contrasena.value).toBe('Abcdef12345!');

    popup.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('usa un mensaje de respaldo cuando el rechazo no incluye error.message', () => {
    service.recuperarCuenta.and.returnValue(of({ success: false }));
    component.recuperarCuenta();
    expect(component.mostrarModalError).toBeTrue();
    expect(component.mensajeErrorRecuperacion).toBe('No fue posible recuperar la cuenta.');
    expect(component.mensajeEstado).toBe('');
  });

  it('muestra también el mensaje anidado del cuerpo de un error HTTP en el popup', () => {
    service.recuperarCuenta.and.returnValue(throwError(() => ({ status: 400, error: { success: false, error: { message: 'Token inválido.' } } })));
    component.recuperarCuenta();
    expect(component.mensajeErrorRecuperacion).toBe('Token inválido.');
    expect(component.mostrarModalError).toBeTrue();
    expect(component.mensajeEstado).toBe('');
    expect(component.enviando).toBeFalse();
  });

  it('conserva la confirmación de éxito y limpia las contraseñas al recuperar la cuenta', () => {
    service.recuperarCuenta.and.returnValue(of({ success: true }));
    component.recuperarCuenta();
    expect(component.mostrarModalExito).toBeTrue();
    expect(component.mostrarModalError).toBeFalse();
    expect(component.recuperarForm.controls.contrasena.value).toBe('');
    expect(component.recuperarForm.controls.contrasenaCon.value).toBe('');
  });
});
