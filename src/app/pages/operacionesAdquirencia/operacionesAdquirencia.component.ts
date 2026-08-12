import { Component, OnInit , inject} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperacionesAdquirenciaService } from '../../services/operacionesadquirencia.service';
import { MultiSelectComponent, Option }
from '../../shared/components/form/multi-select/multi-select.component';
import { DatePickerComponent }
from '../../shared/components/form/date-picker/date-picker.component';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-operacionesAdqui',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule , MultiSelectComponent, DatePickerComponent],
  templateUrl: './operacionesAdquirencia.component.html',
  styleUrls: ['./operacionesAdquirencia.component.css']
})
export class OperacionesAdquirenciaComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = [];
  operaciones: any[] = [];
  comprobanteOperacion: any = null;

tipoOperacionOptions: Option[] = [];
estatusMultiOptions: Option[] = [];

defaultEstatus: string[] = ['15', '27', '31'];
defaultTipoOperacion: string[] = ['1', '2', '3'];

entidades:any[] = [];
sucursales:any[] = [];
cajas:any[] = [];
clasificaciones:any[] = [
  { id: '1', name: 'Transferencia SPEI - Otros Bancos' },
  { id: '2', name: 'Devolucion de transferencia de SPEI' },
  { id: '3', name: 'Recepcion de SPEI Otros Bancos' },
  { id: '4', name: 'Traspaso a cuenta Kash' },
  { id: '9', name: 'Compra en eComerce' },
  { id: '10', name: 'Recargas Moviles- El cargo se realiza a tu cuenta clabe al momento de la emision por lo que la disponibilidad de los fondos queda garantizada' },
  { id: '11', name: 'Pagos de Servicios- El cargo se realiza a tu cuenta clabe al momento de la emision por lo que la disponibilidad de los fondos queda garantizada.' },
  { id: '12', name: 'Retiros con TARJETA fisica en ATM' },
  { id: '13', name: 'Compras con TARJETA fisica y/o Virtual' },
  { id: '14', name: 'Operacion basada en Web Service. Administrativa' },
  { id: '15', name: 'Operacion basada en intercambio de archivos. Administrativa. Fondeo masivo en Lote' },
  { id: '16', name: 'Operacion de Retiro en Corresponsal de la Red Bancaria Onsigna' },
  { id: '17', name: 'Operacion de Retiro en RED Interna del Cliente Onsigna' },
  { id: '18', name: 'Operacion de Deposito en RED Interna del Cliente Onsigna' },
  { id: '19', name: 'Creacion de QR Orden de Pago dentro de la RED Internal del Cliente Onsigna' },
  { id: '20', name: 'Emision de Ordenes de Pago programada Referenciadas (Sucursal)- El cargo se realiza a tu cuenta clabe al momento de la emision por lo que la disponibilidad de los fondos queda garantizada.' },
  { id: '21', name: 'Retiro en Ventanilla de Sucursal de la Red Bancaria Onsigna' },
  { id: '22', name: 'VISA (Nacional Debito)' },
  { id: '23', name: 'Amex (Nacional Debito)' },
  { id: '24', name: 'Pago de un tercero a Comercio utilizando la cuenta clabe de la Red Bancaria Onsigna del Comercio.' },
  { id: '25', name: 'Devolucion de Cobro con Tarjeta' },
  { id: '26', name: 'Cancelacion de Cobro con Tarjeta.' },
  { id: '27', name: 'MasterCard (Nacional Debito)' },
  { id: '28', name: 'Deposito con cuenta dentro de la Red de comercios de Onsigna.' },
  { id: '29', name: 'Recepcion de cuenta Kash' },
  { id: '30', name: 'Transferencia de fondos entre cuentas Onsigna. Receptor' },
  { id: '31', name: 'Bono por referir la plataforma Onsigna.' },
  { id: '32', name: 'Bono de Bienvenida a la plataforma Onsigna.' },
  { id: '33', name: 'registro de batch masivo en Lote' },
  { id: '34', name: 'Deposito masivo en lote' },
  { id: '35', name: 'IVA por Comision por deposito' },
  { id: '36', name: 'IVA por Comision por retiro' },
  { id: '37', name: 'Comision por deposito. Clave 2' },
  { id: '38', name: 'Comision por retiro. Clave 2' },
  { id: '39', name: 'Comision por deposito. Clave 3' },
  { id: '40', name: 'Comision por retiro. Clave 3' },
  { id: '41', name: 'Devolucion de Operacion predeterminada' },
  { id: '42', name: 'Devolucion Pago de Servicios' },
  { id: '43', name: 'Devolucion Retiro en Caja' },
  { id: '44', name: 'Devolucion Retiro con Referencian' },
  { id: '45', name: 'Devolucion Compra Devuelta' },
  { id: '46', name: 'Actualizacion de CEP de SPEI Recibido.' },
  { id: '47', name: 'Devolucion por compra con tarjeta.Adquirencia. Clave 2' },
  { id: '48', name: 'Deposito correspondiente a un prestamo solicitado.' },
  { id: '49', name: 'Cargo a cuenta por una operacion de Inversion solicitada por el cliente.' },
  { id: '50', name: 'Retorno de Inversion' },
  { id: '51', name: 'Compra de Seguro de Vida' },
  { id: '52', name: 'Compra de Seguro de Salud' },
  { id: '53', name: 'IVA por Compra de Seguro de Salud' },
  { id: '54', name: 'Compra de Seguro para gastos funerarios' },
  { id: '55', name: 'IVA por Compra de Seguro de Gastos funerarios' },
  { id: '56', name: 'Vales (Nacional Debito)' },
  { id: '57', name: 'Internacional' },
  { id: '58', name: 'Recepcion Remesas Internacionales' },
  { id: '61', name: 'Traspaso a cuenta de tercero (mismo banco)' },
  { id: '62', name: 'Recepcion de SPEI de la Red Bancaria Onsigna' },
  { id: '63', name: 'Cargo a cuenta por una transferencia de fondos en dolares' },
  { id: '64', name: 'Abono a cuenta por una recepcion de fondos en dolares' },
  { id: '65', name: 'Cargo a cuenta por una transferencia de fondos internacional' },
  { id: '66', name: 'Deposito a cuenta por una recepcion de fondos internacional' },
  { id: '67', name: 'Retiro en cajero de la Red Bancaria Onsigna' },
  { id: '68', name: 'Transferencia de fondos a cuentas de la Red Bancaria Onsigna' },
  { id: '69', name: 'Retiro en cajeros distintos a la Red Bancaria Onsigna' },
  { id: '70', name: 'Tipo de Cambio FX de la Red Bancaria Onsigna' },
  { id: '71', name: 'Generacion de Cuenta Clabe de la Red Bancaria Onsigna' },
  { id: '72', name: 'Asignacion de Tarjeta Fisica' },
  { id: '73', name: 'Asignacion de Tarjeta Virtual' },
  { id: '74', name: 'Solicitud desde la aplicaicon de tarjeta fisica.' },
  { id: '75', name: 'Solicitud desde la aplicaicon de reemplazo de tarjeta fisica.' },
  { id: '76', name: 'Envio de SMS' },
  { id: '77', name: 'Envio de Correo Electronico' },
  { id: '78', name: 'Envio de mensaje Whatsapp' },
  { id: '79', name: 'Procesamiento a traves del sistema PLD' },
  { id: '80', name: 'Plataforma de Gestion de Tickets' },
  { id: '81', name: 'Operacion de Integracion con plataformas de terceros' },
  { id: '82', name: 'Domiciliacion' },
  { id: '86', name: 'MSI VISA' },
  { id: '90', name: 'MSI Mastercard' },
  { id: '94', name: 'MSI AMEX' },
  { id: '104', name: 'Pagos o Depositos a Cuentas Clabe en EFECTIVO- Cajeros de la Red Bancaria Onsigna' },
  { id: '105', name: 'Pagos o Depositos a Cuentas Clabe en EFECTIVO- Corresponsales de la Red Bancaria Onsigna' },
  { id: '106', name: 'Pagos o Depositos a Cuentas Clabe en EFECTIVO- Sucursales de la Red Bancaria Onsigna' },
  { id: '107', name: 'Pagos o Depositos a Cuentas Clabe de CONVENIO' },
  { id: '108', name: 'Recepcion de cuenta de tercero (mismo banco)' },
  { id: '109', name: 'Pagos o Depositos a Cuentas Clabe en EFECTIVO- Mixto' },
  { id: '110', name: 'Pagos o Depositos a Cuentas Clabe en EFECTIVO- Cheques' },
  { id: '125', name: 'Contratacion de TARJETA- pagos que realizas de forma continua' },
  { id: '153', name: 'Permite fondear tu tarjeta' },
  { id: '305', name: 'Traspasos hacia cuentas en Pesos' },
  { id: '306', name: 'Sistema de Pagos Electronicos Interbancarios en Dolares (SPID)- Otros Bancos' },
  { id: '308', name: 'Global Transfers (SWIFT/BIC)- Otros Bancos' },
  { id: '315', name: 'Traspasos o Pagos entre cuentas KASH de terceros- Batch Masivo' },
  { id: '330', name: 'Recompensa Referido- Acumula puntos' },
  { id: '331', name: 'Recompensa Bienvenido- Acumula puntos' },
  { id: '334', name: 'IVA Comision por Deposito' },
  { id: '335', name: 'IVA Comision por Retiro' },
  { id: '347', name: 'Devolucion de transferencia de SPEI' },
  { id: '359', name: 'Onboarding Sin Curp' },
  { id: '360', name: 'Onboarding Con Curp' },
  { id: '361', name: 'Sistema de Pagos Electronicos Interbancarios en Pesos (CECOBAN)- Otros Bancos' },
  { id: '363', name: 'Pagos de Comisiones por Referencias (Reparto de Comisiones)' },
  { id: '376', name: 'SMS (Envio)' },
  { id: '377', name: 'EMAIL (Envio)' },
  { id: '378', name: 'WHATSAPP (Envio)' },
  { id: '379', name: 'PLD (Procesamiento)' },
  { id: '380', name: 'JIRA (Gestion de Tickets)' },
  { id: '381', name: 'Integracion API (Integracion con Terceros)' },
  { id: '382', name: 'Autorizador de TARJETA' },
  { id: '383', name: 'Procesador de TARJETA' },
  { id: '402', name: 'Antifraude' },
  { id: '403', name: 'PROSA Transaccion' },
  { id: '420', name: 'Retencion Rebate Ligado a la operacion' },
  { id: '421', name: 'Compras con TARJETA fisica y/o Virtual- Internacional' },
  { id: '422', name: 'Retiros con TARJETA fisica en ATM- Internacional' },
  { id: '454', name: 'Contratacion Apertura' },
  { id: '455', name: 'Carnet (Nacional Debito)' },
  { id: '456', name: 'Anualidad' },
  { id: '457', name: 'Manejo de Cuenta' },
  { id: '458', name: 'VISA (Nacional Credito)' },
  { id: '459', name: 'MasterCard (Nacional Credito)' },
  { id: '460', name: 'Cuota de Servicio Mensual' }
];
rolId = '2';
subafiliadoSesionBloqueado = false;
entidadSesionBloqueada = false;
sucursalSesionBloqueada = false;
cajaSesionBloqueada = false;



  estatusOptions = [
    { label: 'Procesando', value: '5' },
    { label: 'Denegado', value: '6' },
    { label: 'Reversado', value: '7' },
    { label: 'Cancelado', value: '8' },
    { label: 'Reversando', value: '10' },
    { label: 'Devuelto', value: '11' },
    { label: 'Aprobado', value: '15' },
    { label: 'Creado', value: '25' },
    { label: 'Pendiente de envío', value: '26' },
    { label: 'Enviado', value: '27' },
    { label: 'Rechazado', value: '28' },
    { label: 'Confirmado', value: '29' },
    { label: 'Conciliado', value: '30' },
    { label: 'Liquidado', value: '31' },
    { label: 'Cerrado', value: '32' },
    { label: 'Tarifa dividida', value: '33' }
  ];

  opciones = [
    { id: 1, nombre: 'Opción 1' },
    { id: 2, nombre: 'Opción 2' },
    { id: 3, nombre: 'Opción 3' },
    { id: 4, nombre: 'Opción 4' }
  ];
  
  seleccionados: number[] = [];
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }

  onTipoOperacionChange(selected: string[]) {

  this.formulario.patchValue({
    tipoOperacion: selected
  });

  console.log('Tipos:', selected);

}

onEstatusChange(selected: string[]) {

  this.formulario.patchValue({
    estatus: selected
  });

  console.log('Estatus:', selected);

}
onFechaInicioChange(event: any) {

  this.formulario.patchValue({
    fechaInicio: event.dateStr
  });

  console.log('Fecha Inicio:', event.dateStr);

}

onFechaFinChange(event: any) {

  this.formulario.patchValue({
    fechaFin: event.dateStr
  });

  console.log('Fecha Fin:', event.dateStr);

}



  private  opeAdquiService = inject(OperacionesAdquirenciaService);

  
  constructor(
    private fb: FormBuilder
  ) {
   this.formulario = this.fb.group({
  cuenta: [''],
  entidad: [''],
  sucursal: [''],
  caja: [''],
  clasificacion: [''],
  tipoOperacion: [this.defaultTipoOperacion],
estatus: [this.defaultEstatus],
  fechaInicio: [''],
  fechaFin: ['']
});

  }

 ngOnInit(): void {
  this.rolId = localStorage.getItem('idRol') || this.rolId;

  this.estatusMultiOptions =
  this.estatusOptions.map(item => ({
    value: item.value,
    text: item.label
  }));

  this.cargarDatosIniciales();

  this.formulario.patchValue({
  tipoOperacion: this.defaultTipoOperacion,
  estatus: this.defaultEstatus
});
}

  /*onSubAfiliadoChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const countryId = select.value ? Number(select.value) : null;
    
    this.selectedCountryId.set(countryId);
    this.locationService.setCountry(countryId);
    
    // Resetear selects dependientes
    this.selectedStateId.set(null);
    this.selectedCityId.set(null);
    
    // Simular carga asíncrona si es necesario
    if (countryId) {
      this.simulateAsyncLoad();
    }
  }*/

  cargarDatosIniciales(): void {
    this.cargarSubafiliados();

    // Cargar tipos de operación
   this.cargarTiposOperacion();


this.formulario.get('cuenta')?.valueChanges.subscribe(valor => {

  console.log('SUBAFILIADO:', valor);

  this.formulario.patchValue({ entidad: '', sucursal: '', caja: '' }, { emitEvent: false });
  this.entidades = [];
  this.sucursales = [];
  this.cajas = [];

  if (!valor) return;

  this.opeAdquiService.getEntidades(String(valor)).subscribe({
     next: (resp:any) => {
      this.entidades = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
      this.seleccionarEntidadSesion(this.entidades);
    },

      error: (err) => {

        console.error('ERROR ENTIDADES:', err);

      }

    });

});

this.formulario.get('entidad')?.valueChanges.subscribe(entidad => {
  this.formulario.patchValue({ sucursal: '', caja: '' }, { emitEvent: false });
  this.sucursales = [];
  this.cajas = [];

  if (!entidad) return;

  this.opeAdquiService
    .getSucursales(String(entidad))
    .subscribe({

      next:(resp:any)=>{
        this.sucursales = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
        this.seleccionarSucursalSesion(this.sucursales);

      }

    });

});

this.formulario.get('sucursal')?.valueChanges.subscribe(nodeID => {

  this.formulario.patchValue({ caja: '' }, { emitEvent: false });
  this.cajas = [];

  if (!nodeID) return;

  this.opeAdquiService
    .getCajas(String(nodeID))
    .subscribe({

      next:(resp:any)=>{
        this.cajas = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
        this.seleccionarCajaSesion(this.cajas);

      }

    });

});

this.cargarDependenciasSesion();

    // Cargar estatus
    this.opeAdquiService.obtenerStatus().subscribe({
      next: (data) => {
        this.estatus = data;
      },
      error: (error) => {
        console.error('Error al cargar estatus:', error);
      }
    });
  }
mostrarResultados = false;

  cargarSubafiliados(): void {
    const idContextSesion = localStorage.getItem('idContext') || '';

    if (this.rolId !== '2' || (idContextSesion && idContextSesion !== '0')) {
      this.cargarSubafiliadoSesion();
      return;
    }

    this.opeAdquiService.getSubafiliados().subscribe({
      next: (resp: any) => {
        this.cuentas = this.normalizarLista(resp, ['contextResponse', 'rows', 'data']);
      },
      error: (error) => {
        console.error('Error al cargar subafiliados:', error);
        this.cargarSubafiliadoSesion();
      }
    });
  }

  private cargarSubafiliadoSesion(): void {
    this.opeAdquiService.getSubafiliadoById().subscribe({
      next: (resp: any) => {
        this.cuentas = this.normalizarLista(resp, ['contextResponse', 'rows', 'data']);
        this.seleccionarSubafiliadoSesion(this.cuentas);
      },
      error: (error) => {
        this.cuentas = [];
        this.seleccionarSubafiliadoSesion([]);
        console.error('Error al cargar subafiliado por sesión:', error);
      }
    });
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.getRawValue();
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      this.opeAdquiService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          this.operaciones = response.response?.operations || response.operations || response.content || response.rows?.content || response.rows || [];
          this.mostrarResultados = true;
          console.log('Formulario enviado exitosamente:', response);

          console.log('operaciones enviado exitosamente:', this.operaciones);
          // Aquí puedes agregar lógica adicional, como mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al enviar formulario:', error);
        }
      });
    }
  }

  cargarTiposOperacion(): void {

  this.opeAdquiService.obtenerTiposOperacion().subscribe({

    next: (response: any) => {

      this.tiposOperacion =
      response.catOperationTypes || [];

      this.tipoOperacionOptions =
      this.tiposOperacion.map((tipo: any) => ({

        value: String(tipo.idOperationType),

        text:
          tipo.descriptionApp ||
          tipo.name

      }));

      this.defaultTipoOperacion =
      this.tipoOperacionOptions
        .slice(0, 3)
        .map(x => x.value);

      this.formulario.patchValue({
        tipoOperacion: this.defaultTipoOperacion
      });

    },

    error: (error) => {

      console.error('Error:', error);

      this.tiposOperacion = [];

    }

  });

}

  limpiarFormulario(): void {
    this.formulario.reset();
    this.aplicarBloqueosSesion();
    this.cargarDependenciasSesion();
  }

  private cargarDependenciasSesion(): void {
    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    if (!nodeIDSesion) return;

    if (this.rolId === '4') {
      this.opeAdquiService.getEntidades(nodeIDSesion).subscribe({
        next: (resp: any) => {
          this.entidades = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
          this.seleccionarEntidadSesion(this.entidades);
        },
        error: (error) => console.error('Error al cargar entidades de sesión:', error)
      });
    }

    if (this.rolId === '5') {
      this.opeAdquiService.getSucursales(nodeIDSesion).subscribe({
        next: (resp: any) => {
          this.sucursales = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
          this.seleccionarSucursalSesion(this.sucursales);
        },
        error: (error) => console.error('Error al cargar sucursales de sesión:', error)
      });
    }

    if (this.rolId === '6') {
      this.opeAdquiService.getCajas(nodeIDSesion).subscribe({
        next: (resp: any) => {
          this.cajas = this.normalizarLista(resp, ['rows', 'contextResponse', 'data']);
          this.seleccionarCajaSesion(this.cajas);
        },
        error: (error) => console.error('Error al cargar cajas de sesión:', error)
      });
    }
  }

  private seleccionarSubafiliadoSesion(subafiliados: any[]): void {
    this.subafiliadoSesionBloqueado = false;

    if (this.rolId !== '3') {
      this.aplicarBloqueosSesion();
      return;
    }

    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeSubafiliadoSesion = subafiliados.some(
      subafiliado => this.obtenerNodeId(subafiliado) === nodeIDSesion
    );

    if (existeSubafiliadoSesion) {
      this.formulario.patchValue({ cuenta: nodeIDSesion });
      this.subafiliadoSesionBloqueado = true;
    }

    this.aplicarBloqueosSesion();
  }

  private seleccionarEntidadSesion(entidades: any[]): void {
    this.entidadSesionBloqueada = false;

    if (this.rolId !== '4') {
      this.aplicarBloqueosSesion();
      return;
    }

    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeEntidadSesion = entidades.some(
      entidad => this.obtenerNodeId(entidad) === nodeIDSesion
    );

    if (existeEntidadSesion) {
      this.formulario.patchValue({ entidad: nodeIDSesion });
      this.entidadSesionBloqueada = true;
    }

    this.aplicarBloqueosSesion();
  }

  private seleccionarSucursalSesion(sucursales: any[]): void {
    this.sucursalSesionBloqueada = false;

    if (this.rolId !== '5') {
      this.aplicarBloqueosSesion();
      return;
    }

    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeSucursalSesion = sucursales.some(
      sucursal => this.obtenerNodeId(sucursal) === nodeIDSesion
    );

    if (existeSucursalSesion) {
      this.formulario.patchValue({ sucursal: nodeIDSesion });
      this.sucursalSesionBloqueada = true;
    }

    this.aplicarBloqueosSesion();
  }

  private seleccionarCajaSesion(cajas: any[]): void {
    this.cajaSesionBloqueada = false;

    if (this.rolId !== '6') {
      this.aplicarBloqueosSesion();
      return;
    }

    const nodeIDSesion = localStorage.getItem('nodeID') || '';
    const existeCajaSesion = cajas.some(
      caja => this.obtenerNodeId(caja) === nodeIDSesion
    );

    if (existeCajaSesion) {
      this.formulario.patchValue({ caja: nodeIDSesion });
      this.cajaSesionBloqueada = true;
    }

    this.aplicarBloqueosSesion();
  }

  private aplicarBloqueosSesion(): void {
    this.actualizarEstadoControl('cuenta', this.subafiliadoSesionBloqueado);
    this.actualizarEstadoControl('entidad', this.entidadSesionBloqueada);
    this.actualizarEstadoControl('sucursal', this.sucursalSesionBloqueada);
    this.actualizarEstadoControl('caja', this.cajaSesionBloqueada);
  }

  private actualizarEstadoControl(nombre: string, bloqueado: boolean): void {
    const control = this.formulario.get(nombre);
    if (!control) return;
    bloqueado
      ? control.disable({ emitEvent: false })
      : control.enable({ emitEvent: false });
  }

  private obtenerNodeId(item: any): string {
    return String(item?.idNode ?? item?.nodeID ?? item?.affiliationId ?? item?.id ?? '');
  }

  private normalizarLista(resp: any, keys: string[]): any[] {
    if (Array.isArray(resp)) return resp;

    for (const key of keys) {
      const value = resp?.[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return [value];
    }

    return resp && typeof resp === 'object' ? [resp] : [];
  }

  verTicket(operacion: any): void {
    this.mostrarComprobanteOperacion(operacion);
  }

  private mostrarComprobanteOperacion(operacion: any): void {
    const fechaCompleta = this.obtenerPrimerValor(operacion.createdAt, operacion.posDate, operacion.timestamp);
    const fecha = fechaCompleta ? new Date(fechaCompleta) : null;
    const monto = Number(operacion.amount || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: operacion.currency?.alphabeticCode || 'MXN'
    });

    this.comprobanteOperacion = {
      id: operacion.id || '',
      fecha: fecha ? fecha.toISOString().slice(0, 10) : '',
      hora: fecha ? fecha.toTimeString().slice(0, 8) : '',
      monto,
      banco: this.obtenerBancoDestinatario(operacion),
      cuentaDestino: this.obtenerPrimerValor(operacion.targetID, operacion.accountNumber),
      destinatario: this.obtenerPrimerValor(operacion.targetName, operacion.originalUsername),
      referenciaNumerica: this.obtenerPrimerValor(operacion.numericReference),
      claveRastreo: this.obtenerPrimerValor(operacion.externalReference, operacion.internalReference),
      concepto: this.obtenerConceptoPago(operacion),
      usuarioOrigen: this.obtenerPrimerValor(operacion.originalUsername),
      emailOrigen: this.obtenerPrimerValor(operacion.originalEmail, operacion.observation),
      observacion: this.obtenerPrimerValor(operacion.observation, operacion.description),
      moneda: operacion.currency?.alphabeticCode || 'MXN'
    };
  }

  cerrarComprobante(): void {
    this.comprobanteOperacion = null;
  }

  imprimirComprobante(): void {
    const contenido = document.querySelector('.voucher-print-area')?.innerHTML;
    if (!contenido) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <title>Comprobante</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
            .voucher-print-area { max-width: 560px; margin: 0 auto; padding: 22px 38px; }
            .voucher-brand { width: 100%; min-height: 46px; display: flex; align-items: center; padding: 0 16px; background: #344154; color: #f4f6f8; font-size: 28px; font-weight: 900; letter-spacing: .05em; text-shadow: 0 3px 5px rgba(0,0,0,.42); }
            .voucher-datetime { margin-top: 22px; color: #8a8f9d; font-size: 14px; line-height: 1.7; }
            .voucher-datetime p, .voucher-section p { margin: 0; }
            .voucher-message { margin: 34px 0 42px; color: #111827; text-align: center; font-size: 15px; line-height: 1.5; }
            .voucher-section { display: grid; grid-template-columns: 145px 1fr; gap: 24px; margin-top: 16px; color: #858b99; font-size: 14px; line-height: 1.55; }
            .voucher-section-title { align-self: center; font-weight: 750; }
            .voucher-section-body strong, .voucher-grid strong, .voucher-grid span { color: #858b99; }
            .voucher-section-body strong, .voucher-grid span { font-weight: 800; }
            .voucher-divider { height: 1px; margin: 24px 0 10px 145px; background: #e5e7eb; }
            .voucher-grid { display: grid; grid-template-columns: 155px 1fr; column-gap: 24px; row-gap: 5px; }
          </style>
        </head>
        <body><div class="voucher-print-area">${contenido}</div></body>
      </html>
    `);
    doc.close();

    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1_000);
    }, 150);
  }

  exportarExcel(): void {
    if (!this.operaciones?.length) return;

    const fecha = this.obtenerFechaArchivo();
    const encabezados = [
      'ID',
      'TIPO',
      'VENTA NETA',
      'MONTO',
      'ESTATUS',
      'DESCRIPCION',
      'FECHA',
      'CODIGO DE RESPUESTA',
      'REFERENCIA NUMERICA',
      'REFERENCIA ALFANUMERICA',
      'TARGETEMAIL',
      'REFERENCIA INTERNA',
      'REFERENCIA EXTERNA',
      'TRANSACTIONBUNDLER',
      'OBSERVACION',
      'USUARIO',
      'USUARIO ORIGEN',
      'EMAIL ORIGEN',
      'CUENTA DESTINATARIO',
      'NOMBRE DEL DESTINATARIO',
      'BANCO DESTINATARIO',
      'CEP INT.',
      'CEP EXT.',
      'DETALLE'
    ];

    const filas = this.operaciones.map(operacion => [
      operacion.id ?? '',
      operacion.descriptionType ?? '',
      this.formatoExcelMoneda(operacion.amount),
      this.formatoExcelMoneda(operacion.settleAmount ?? 0),
      this.obtenerEstatusOperacion(operacion.status),
      operacion.description ?? '',
      this.formatoExcelFecha(operacion.createdAt),
      operacion.responseCode ?? '',
      operacion.numericReference ?? '',
      operacion.alphanumericReference ?? '',
      operacion.targetEmail ?? '',
      operacion.internalReference ?? '',
      operacion.externalReference ?? '',
      operacion.transactionBundler ?? '',
      operacion.observation ?? '',
      operacion.originalUsername ?? '',
      operacion.originalUsername ?? '',
      operacion.originalEmail ?? '',
      operacion.targetID ?? '',
      operacion.targetName ?? '',
      this.obtenerBancoDestinatario(operacion),
      operacion.cepInt ?? operacion.cepInternal ?? '',
      operacion.cepExt ?? operacion.cepExternal ?? '',
      ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`Operaciones-Adquirencia-${fecha}`],
      encabezados,
      ...filas
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } }];
    worksheet['!cols'] = encabezados.map((encabezado) => ({ wch: Math.max(14, Math.min(34, encabezado.length + 4)) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operaciones');
    XLSX.writeFile(workbook, `Operaciones-Adquirencia-${fecha}.xlsx`);
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatoExcelMoneda(value: unknown): string {
    const amount = Number(value || 0);
    return `$ ${amount.toFixed(2)}`;
  }

  private formatoExcelFecha(value: unknown): string {
    if (!value) return '';
    const fecha = new Date(String(value));
    if (Number.isNaN(fecha.getTime())) return String(value);
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = String(fecha.getFullYear()).slice(-2);
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private obtenerEstatusOperacion(status: unknown): string {
    const statusMap: Record<string, string> = {
      '15': 'Aprobado',
      '27': 'Enviado',
      '31': 'Liquidado'
    };

    return statusMap[String(status ?? '')] || String(status ?? '');
  }

  private obtenerBancoDestinatario(operacion: any): string {
    return this.obtenerPrimerValor(
      operacion.targetBank,
      operacion.bankName,
      operacion.institution,
      operacion.targetIDCode
    );
  }

  private obtenerConceptoPago(operacion: any): string {
    const descripcion = this.obtenerPrimerValor(operacion.description);
    const partes = descripcion.split('|').filter(Boolean);
    return partes.length >= 3 ? partes[2] : descripcion;
  }

  private abrirRespuestaTicket(ventanaTicket: Window, respuesta: any): void {
    if (respuesta?.voucher) {
      const voucherBase64 = this.convertirVoucherABase64(respuesta.voucher);
      const mimeType = respuesta.mimeType || respuesta.contentType || 'application/pdf';
      const urlVoucher = URL.createObjectURL(this.base64ABlob(voucherBase64, mimeType));
      ventanaTicket.location.href = urlVoucher;
      window.setTimeout(() => URL.revokeObjectURL(urlVoucher), 60_000);
      return;
    }

    const url = respuesta?.url || respuesta?.ticketUrl || respuesta?.voucherUrl || respuesta?.data?.url;
    if (url) {
      ventanaTicket.location.href = url;
      return;
    }

    ventanaTicket.close();
    console.error('No fue posible obtener el ticket:', respuesta);
  }

  private convertirVoucherABase64(voucher: unknown): string {
    if (typeof voucher === 'string') {
      const contenido = voucher.trim();
      const dataUrl = contenido.match(/^data:[^;]+;base64,(.+)$/i);
      if (dataUrl) return dataUrl[1];

      try {
        const contenidoDecodificado = atob(contenido);
        if (contenidoDecodificado.startsWith('%PDF')) return contenido;
      } catch {
        // El contenido todavía no está codificado en Base64.
      }

      return this.bytesABase64(new TextEncoder().encode(voucher));
    }

    if (voucher instanceof ArrayBuffer) {
      return this.bytesABase64(new Uint8Array(voucher));
    }

    if (Array.isArray(voucher)) {
      return this.bytesABase64(new Uint8Array(voucher));
    }

    if (voucher && typeof voucher === 'object' && Array.isArray((voucher as { data?: unknown }).data)) {
      return this.bytesABase64(new Uint8Array((voucher as { data: number[] }).data));
    }

    return this.bytesABase64(new TextEncoder().encode(JSON.stringify(voucher ?? '')));
  }

  private bytesABase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    let contenidoBinario = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
      contenidoBinario += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(contenidoBinario);
  }

  private base64ABlob(base64: string, mimeType: string): Blob {
    const contenidoBinario = atob(base64);
    const chunkSize = 0x8000;
    const partes: ArrayBuffer[] = [];

    for (let offset = 0; offset < contenidoBinario.length; offset += chunkSize) {
      const segmento = contenidoBinario.slice(offset, offset + chunkSize);
      const bytes = new Uint8Array(segmento.length);

      for (let index = 0; index < segmento.length; index++) {
        bytes[index] = segmento.charCodeAt(index);
      }

      partes.push(bytes.buffer);
    }

    return new Blob(partes, { type: mimeType });
  }

  private obtenerPrimerValor(...valores: unknown[]): string {
    const valor = valores.find(item => item !== null && item !== undefined && item !== '');
    return String(valor ?? '');
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  
}


  
