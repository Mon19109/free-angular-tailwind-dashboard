import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { StepAccesosComponent, UsuarioAccesoConfig } from '../preRegistro/components/accesos/step-accesos.component';
import { StepLiquidacionComponent } from '../preRegistro/components/liquidacion/step-liquidacion.component';
import { ProspectoCliente, ProspectoClienteService } from '../../services/prospecto-cliente.service';

type ModoReserva = 'NINGUNO' | 'MANUAL' | 'TRANSACCIONAL' | 'AUTOMÁTICO' | 'COMPLETO';
type TipoPersonaBeneficiario = 'fisica' | 'moral';
type PrefijoAcceso = 'admin' | 'fac' | 'tkt' | 'controlador' | 'supervisor';

@Component({
  selector: 'app-registro-prospecto-cliente',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    StepAccesosComponent,
    StepLiquidacionComponent
  ],
  templateUrl: './registroProspectoCliente.component.html',
  styleUrls: ['./registroProspectoCliente.component.css']
})
export class RegistroProspectoClienteComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly prospectoService = inject(ProspectoClienteService);
  private readonly prospectIdStorageKey = 'kashpay.registro_prospecto.prospectId';

  readonly tiposCuenta = ['CLABE', 'Tarjeta'];
  readonly usuariosAcceso: UsuarioAccesoConfig[] = [
    {
      prefijo: 'admin',
      titulo: 'Administrador de la Plataforma',
      descripcion: 'con Acceso Total y Gestión de Pagos.',
      icono: 'fa-regular fa-user'
    }
  ];

  readonly accesosForm = this.fb.nonNullable.group({
    modoReserva: ['NINGUNO' as ModoReserva, Validators.required],
    reservaSplit: [''],
    adminNombre: ['', Validators.required],
    adminPaterno: ['', Validators.required],
    adminMaterno: ['', Validators.required],
    adminCorreo: ['', [Validators.required, Validators.email]],
    adminConfirmarCorreo: ['', [Validators.required, Validators.email]],
    adminTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    facNombre: [''], facPaterno: [''], facMaterno: [''], facCorreo: ['', Validators.email], facConfirmarCorreo: ['', Validators.email], facTelefono: [''],
    tktNombre: [''], tktPaterno: [''], tktMaterno: [''], tktCorreo: ['', Validators.email], tktConfirmarCorreo: ['', Validators.email], tktTelefono: [''],
    controladorNombre: [''], controladorPaterno: [''], controladorMaterno: [''], controladorCorreo: ['', Validators.email], controladorConfirmarCorreo: ['', Validators.email], controladorTelefono: [''],
    supervisorNombre: [''], supervisorPaterno: [''], supervisorMaterno: [''], supervisorCorreo: ['', Validators.email], supervisorConfirmarCorreo: ['', Validators.email], supervisorTelefono: [''],
    perfilReservaNombre: [''], perfilReservaPaterno: [''], perfilReservaMaterno: [''], perfilReservaCorreo: [''], perfilReservaConfirmarCorreo: [''], perfilReservaTelefono: [''],
    cajasTPV: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]],
    tieneSupervisor: ['si', Validators.required],
    pinAdministrador: [''], pinCorreo: [''], pinConfirmarCorreo: [''], pinContrasena: ['']
  }, {
    validators: [
      this.camposCoincidenValidator('adminCorreo', 'adminConfirmarCorreo', 'adminCorreosDistintos'),
      this.camposCoincidenValidator('facCorreo', 'facConfirmarCorreo', 'facCorreosDistintos'),
      this.camposCoincidenValidator('tktCorreo', 'tktConfirmarCorreo', 'tktCorreosDistintos'),
      this.camposCoincidenValidator('controladorCorreo', 'controladorConfirmarCorreo', 'controladorCorreosDistintos'),
      this.camposCoincidenValidator('supervisorCorreo', 'supervisorConfirmarCorreo', 'supervisorCorreosDistintos'),
      this.camposCoincidenValidator('perfilReservaCorreo', 'perfilReservaConfirmarCorreo', 'perfilCorreosDistintos'),
      this.camposCoincidenValidator('pinCorreo', 'pinConfirmarCorreo', 'pinCorreosDistintos')
    ]
  });

  readonly liquidacionForm = this.fb.nonNullable.group({
    cuentaFueraRed: ['otros-bancos', Validators.required],
    digitoVerificador: [''],
    tipoPersonaBeneficiario: ['fisica' as TipoPersonaBeneficiario, Validators.required],
    beneficiarioIgualComercio: [false],
    nombreBeneficiario: ['', Validators.required],
    apellidoPaternoBeneficiario: ['', Validators.required],
    apellidoMaternoBeneficiario: ['', Validators.required],
    correoBeneficiario: ['', [Validators.required, Validators.email]],
    direccionBeneficiario: ['', Validators.required],
    rfcBeneficiario: ['', [Validators.required, this.rfcValidator()]],
    actividadBeneficiario: ['', Validators.required],
    giroBeneficiario: ['', Validators.required],
    tipoCuenta: ['', Validators.required],
    cuentaClabe: ['', Validators.required],
    nombreBanco: ['', Validators.required],
    direccionBanco: ['', Validators.required],
    telefonoBanco: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    emailBanco: ['', [Validators.required, Validators.email]]
  });

  prospectId = '';
  link = '';
  cargando = true;
  guardando = false;
  error = '';
  mensaje = '';
  pasoActivo: 'liquidacion' | 'accesos' = 'liquidacion';
  prospecto: ProspectoCliente | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const pathLink = this.route.snapshot.paramMap.get('link') || '';
    this.prospectId = params.get('prospectId')
      || params.get('prospect')
      || params.get('id')
      || localStorage.getItem(this.prospectIdStorageKey)
      || '';
    this.link = params.get('link') || pathLink;

    if (params.get('prospectId') || params.get('prospect') || params.get('id')) {
      localStorage.setItem(this.prospectIdStorageKey, this.prospectId);
    }

    this.liquidacionForm.controls.cuentaFueraRed.valueChanges
      .subscribe(() => this.actualizarEstadoLiquidacion());
    this.liquidacionForm.controls.tipoPersonaBeneficiario.valueChanges
      .subscribe(tipo => this.actualizarValidadoresBeneficiario(tipo as TipoPersonaBeneficiario));
    this.liquidacionForm.controls.tipoCuenta.valueChanges
      .subscribe(() => this.actualizarValidadorCuentaLiquidacion());

    this.actualizarEstadoLiquidacion();
    this.actualizarValidadorCuentaLiquidacion();

    if (!this.prospectId || !this.link) {
      this.cargando = false;
      this.error = this.link
        ? 'El link no contiene prospectId para validar el registro. Agrega prospectId al enlace generado.'
        : 'El link no contiene token para validar el registro.';
      return;
    }

    this.cargarProspecto();
  }

  continuarLiquidacion(): void {
    this.mensaje = '';
    this.pasoActivo = 'accesos';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volverLiquidacion(): void {
    this.mensaje = '';
    this.pasoActivo = 'liquidacion';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalizar(): void {
    this.mensaje = '';
    this.error = '';
    this.liquidacionForm.markAllAsTouched();
    this.accesosForm.markAllAsTouched();

    if (this.liquidacionForm.invalid || this.accesosForm.invalid) {
      this.error = 'Completa los campos obligatorios para enviar el registro.';
      return;
    }

    this.guardando = true;
    this.prospectoService.guardarCapturaCliente({
      prospectId: this.prospectId,
      link: this.link,
      liquidacion: this.liquidacionForm.getRawValue(),
      accesos: this.accesosForm.getRawValue()
    }).pipe(
      finalize(() => this.guardando = false)
    ).subscribe({
      next: () => {
        this.mensaje = 'Información enviada correctamente.';
      },
      error: () => {
        this.error = 'No fue posible guardar la información. Verifica el endpoint de guardado del prospecto.';
      }
    });
  }

  private cargarProspecto(): void {
    this.cargando = true;
    this.error = '';

    this.prospectoService.obtenerProspecto(this.prospectId, this.link).pipe(
      finalize(() => this.cargando = false)
    ).subscribe({
      next: resp => {
        this.prospecto = resp?.accountResponse ?? null;
        this.precargarDatosProspecto();
      },
      error: () => {
        this.error = 'No fue posible validar el link del prospecto.';
      }
    });
  }

  private precargarDatosProspecto(): void {
    if (!this.prospecto) return;

    this.accesosForm.patchValue({
      adminCorreo: this.texto(this.prospecto.email),
      adminConfirmarCorreo: this.texto(this.prospecto.email),
      adminTelefono: this.texto(this.prospecto.phoneNumber)
    }, { emitEvent: false });
  }

  private actualizarEstadoLiquidacion(): void {
    const requiereDatos = ['otros-bancos', 'otros-bancos-en-red', 'si'].includes(this.liquidacionForm.controls.cuentaFueraRed.value);
    const controles = [
      this.liquidacionForm.controls.tipoPersonaBeneficiario,
      this.liquidacionForm.controls.nombreBeneficiario,
      this.liquidacionForm.controls.apellidoPaternoBeneficiario,
      this.liquidacionForm.controls.apellidoMaternoBeneficiario,
      this.liquidacionForm.controls.correoBeneficiario,
      this.liquidacionForm.controls.direccionBeneficiario,
      this.liquidacionForm.controls.rfcBeneficiario,
      this.liquidacionForm.controls.actividadBeneficiario,
      this.liquidacionForm.controls.giroBeneficiario,
      this.liquidacionForm.controls.tipoCuenta,
      this.liquidacionForm.controls.cuentaClabe,
      this.liquidacionForm.controls.nombreBanco,
      this.liquidacionForm.controls.direccionBanco,
      this.liquidacionForm.controls.telefonoBanco,
      this.liquidacionForm.controls.emailBanco,
    ];

    if (!requiereDatos) {
      controles.forEach(control => {
        control.clearValidators();
        control.disable({ emitEvent: false });
        control.updateValueAndValidity({ emitEvent: false });
      });
      return;
    }

    controles.forEach(control => control.enable({ emitEvent: false }));
    this.liquidacionForm.controls.nombreBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.correoBeneficiario.setValidators([Validators.required, Validators.email]);
    this.liquidacionForm.controls.direccionBeneficiario.setValidators([Validators.required]);
    this.liquidacionForm.controls.rfcBeneficiario.setValidators([Validators.required, this.rfcValidator()]);
    this.liquidacionForm.controls.tipoCuenta.setValidators([Validators.required]);
    this.liquidacionForm.controls.cuentaClabe.setValidators([Validators.required]);
    this.liquidacionForm.controls.nombreBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.direccionBanco.setValidators([Validators.required]);
    this.liquidacionForm.controls.telefonoBanco.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
    this.liquidacionForm.controls.emailBanco.setValidators([Validators.required, Validators.email]);
    this.actualizarValidadoresBeneficiario(this.liquidacionForm.controls.tipoPersonaBeneficiario.value as TipoPersonaBeneficiario);
    controles.forEach(control => control.updateValueAndValidity({ emitEvent: false }));
  }

  private actualizarValidadoresBeneficiario(tipo: TipoPersonaBeneficiario): void {
    const apellidosRequeridos = tipo === 'fisica';
    this.liquidacionForm.controls.apellidoPaternoBeneficiario.setValidators(apellidosRequeridos ? [Validators.required] : []);
    this.liquidacionForm.controls.apellidoMaternoBeneficiario.setValidators(apellidosRequeridos ? [Validators.required] : []);
    this.liquidacionForm.controls.actividadBeneficiario.setValidators(tipo === 'fisica' ? [Validators.required] : []);
    this.liquidacionForm.controls.giroBeneficiario.setValidators(tipo === 'moral' ? [Validators.required] : []);
    this.liquidacionForm.controls.rfcBeneficiario.setValidators([Validators.required, this.rfcValidator()]);

    [
      this.liquidacionForm.controls.apellidoPaternoBeneficiario,
      this.liquidacionForm.controls.apellidoMaternoBeneficiario,
      this.liquidacionForm.controls.actividadBeneficiario,
      this.liquidacionForm.controls.giroBeneficiario,
      this.liquidacionForm.controls.rfcBeneficiario
    ].forEach(control => control.updateValueAndValidity({ emitEvent: false }));
  }

  private actualizarValidadorCuentaLiquidacion(): void {
    const control = this.liquidacionForm.controls.cuentaClabe;
    const tipoCuenta = this.liquidacionForm.controls.tipoCuenta.value;
    const validadores = tipoCuenta === 'Tarjeta'
      ? [Validators.required, this.numeroCuentaValidator(16, 'tarjetaInvalida')]
      : [Validators.required, this.numeroCuentaValidator(18, 'clabeInvalida')];

    control.setValidators(validadores);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private camposCoincidenValidator(campo: string, confirmacion: string, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const origen = control.get(campo)?.value;
      const destino = control.get(confirmacion)?.value;
      if (!origen || !destino || origen === destino) return null;
      return { [errorKey]: true };
    };
  }

  private numeroCuentaValidator(longitud: number, errorKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`;
      if (!valor) return null;
      return new RegExp(`^\\d{${longitud}}$`).test(valor) ? null : { [errorKey]: true };
    };
  }

  private rfcValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = `${control.value ?? ''}`.trim().toUpperCase();
      if (!valor) return null;
      return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(valor) ? null : { rfcInvalido: true };
    };
  }

  private texto(valor: unknown): string {
    return typeof valor === 'string' ? valor : '';
  }
}
