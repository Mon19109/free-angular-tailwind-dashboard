import { Component , inject, signal} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AddLinkPagoService, FormularioData, NotificacionPagoData } from '../../services/addlinkpago.service';
//import { AuthService, UserSessionData } from '../../services/auth.service';
//import { TextAreaComponent } from '../../shared/components/form/input/text-area.component';
import { InputFieldComponent } from '../../shared/components/form/input/input-field.component';
import { DefaultInputsComponent } from '../../shared/components/form/form-elements/default-inputs/default-inputs.component';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';
//import { CheckboxComponentsComponent } from '../../shared/components/form/form-elements/checkbox-components/checkbox-components.component';


@Component({
  selector: 'app-addlinkpago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,LabelComponent,InputFieldComponent,
    DefaultInputsComponent,DatePickerComponent,SelectComponent],
  templateUrl: './addLinkPago.component.html',
  styleUrls: ['./addLinkPago.component.css']
})
export class AddLinkPagoComponent {
    formulario: FormGroup;
    nombre: any[] = [];
    aPaterno: any[] = [];
    aMaterno: any[] = [];
    tel: any[] = [];
    email: any[] = [];
    ref1: any[] = [];
    ref2: any[] = [];
    monto: any[] = [];
    refCom: any[] = [];
    concepto: any[] = [];
    fechaVen: any[] = [];
    propina: any[] = [];
    msi: any[] = [];
    tPago: any[] = [];
    tNoti: any[] = [];
    
    selectedOptionPago = '';
    selectedOptionNoti = '';
    productoEntrada = '';
    dateValue: any;
    timeValue = '';
    cardNumber = '';
    seleccionados: number[] = [];

    optionPago = signal<any[]>([]);
    optionNoti = signal<any[]>([]);

    loading = signal<boolean>(false);
    mensajeEstado = '';
    mensajeEsError = false;
    mostrarDiv = false;
    mostrarDiv2 = false;
    mostrarForm = true;
    opcionSeleccionada = '';
    linkPago = '';
    codigoBoton = '';
    botonSeleccionado = 'btn-azul';
    textoCopiado = '';
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }

  private  addlinkpagoService = inject(AddLinkPagoService);
  private router = inject(Router);
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
      aPaterno: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
      aMaterno: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
      tel: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      tipoNoti: ['', Validators.required],
      tipoPago: ['', Validators.required],
      productos: [[] as string[]],
      ref1: ['', Validators.required],
      ref2: ['', Validators.required],
      monto: ['', [
        Validators.required,
        Validators.min(0.01),
        Validators.pattern(/^\d+(\.\d{1,2})?$/)
      ]],
      refCom: ['', Validators.required],
      concepto: ['', Validators.required],
      fechaVen: ['', Validators.required],
      propina: [false],
      msi: [false]

    });
  }
  
  handleSelectChangePago(value: string) {
    this.selectedOptionPago = value;
    this.actualizarControl('tipoPago', value);
    console.log('Selected value:', value);
  }
  handleSelectChangeNoti(value: string) {
    this.selectedOptionNoti = value;
    this.actualizarControl('tipoNoti', value);
    console.log('Selected value:', value);
    //this.opcionSeleccionada = value
  }
  handleDateChange(event: any) {
    this.dateValue = event;
    this.actualizarControl('fechaVen', event?.dateStr ?? event ?? '');
    console.log('Date changed:', event);
  }

  actualizarControl(nombre: string, valor: unknown): void {
    this.formulario.get(nombre)?.setValue(valor);
    this.formulario.get(nombre)?.markAsDirty();
  }

  mostrarCampoObligatorio(nombre: string): boolean {
    const control = this.formulario.get(nombre);
    return !!control?.hasError('required') && (control.touched || control.dirty);
  }

  procesarMonto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valorNormalizado = input.value.replace(',', '.').replace(/[^\d.]/g, '');
    const partes = valorNormalizado.split('.');
    const entero = partes.shift() || '';
    const tieneDecimal = valorNormalizado.includes('.');
    const decimales = partes.join('').slice(0, 2);
    const monto = tieneDecimal ? `${entero || '0'}.${decimales}` : entero;

    input.value = monto;
    this.actualizarControl('monto', monto);
  }

  procesarNombre(campo: 'nombre' | 'aPaterno' | 'aMaterno', event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/[^A-Za-z ]/g, '');

    input.value = valor;
    this.actualizarControl(campo, valor);
  }

  procesarEntradaProductos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value;

    if (!/[,\n]/.test(valor)) {
      this.productoEntrada = valor;
      return;
    }

    const terminaConSeparador = /[,\n]\s*$/.test(valor);
    const partes = valor.split(/[,\n]+/);
    const pendiente = terminaConSeparador ? '' : partes.pop() || '';

    this.agregarProductos(partes);
    this.productoEntrada = pendiente;
    input.value = pendiente;
  }

  procesarTeclaProducto(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') return;

    event.preventDefault();
    this.confirmarProductoPendiente();
    (event.target as HTMLInputElement).value = '';
  }

  confirmarProductoPendiente(): void {
    this.agregarProductos([this.productoEntrada]);
    this.productoEntrada = '';
  }

  eliminarProducto(producto: string): void {
    const productos = (this.formulario.get('productos')?.value || []) as string[];
    this.actualizarControl('productos', productos.filter(item => item !== producto));
  }

  private agregarProductos(valores: string[]): void {
    const productosActuales = (this.formulario.get('productos')?.value || []) as string[];
    const productos = [...productosActuales];

    for (const valor of valores) {
      const producto = valor.trim();
      if (!producto) continue;

      const yaExiste = productos.some(item => item.toLowerCase() === producto.toLowerCase());
      if (!yaExiste) productos.push(producto);
    }

    this.actualizarControl('productos', productos);
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.addlinkpagoService.obtenerTipoNoti().subscribe({
      next: (data) => {
        console.error('tNoti:', this.tNoti);

        /*let datosNoti = data.map(item => ({
          codigo: item.id,        
          nombreCompleto: item.value 
        }));*/

        const registrosNoti = Array.isArray(data)
          ? data.flatMap((datos: any) => Array.isArray(datos) ? datos : [datos])
          : [];
        let datosNoti = registrosNoti.map((item: any) => ({
          value: item.notificationTypeID ?? item.id ?? item.paymentMethodID,
          label: item.descripcion ?? item.description ?? item.value
        }));

        this.tNoti = datosNoti;
        this.optionNoti.set(datosNoti);


      },
      error: (error) => {
        console.error('Error Not:', error);
      }
    });

    this.addlinkpagoService.obtenerTipoPago().subscribe({
      next: (data) => {
        console.error('tPago:', data);
        this.tPago = data;
        const datosPago = Array.isArray(data)
          ? data.flatMap((datos: any) => Array.isArray(datos) ? datos : [datos]).map((item: any) => ({
              value: item.paymentMethodID ?? item.id,
              label: item.descripcion ?? item.description ?? item.value
            }))
          : [];
        this.optionPago.set(datosPago);
      },
      error: (error) => {
        console.error('Error :', error);
      }
    });

  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      /*this.addlinkpagoService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          console.log('Formulario enviado exitosamente:', response);
          this.operaciones = response.operations || [];

          console.log('operaciones enviado exitosamente:', this.operaciones);
          // Aquí puedes agregar lógica adicional, como mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al enviar formulario:', error);
        }
      });*/
    }
  }

 
  limpiarFormulario(): void {
    this.formulario.reset();
  }

  verBotones() {
    console.log('verBotones');
    this.loading.set(false);
    this.confirmarProductoPendiente();

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    console.log('selectedOptionNoti = '+this.selectedOptionNoti);
    if (this.selectedOptionNoti == '1') {
        this.mostrarDiv = true;
        this.mostrarForm = false;
    }else{
        this.mostrarDiv = false; 
        this.mostrarForm = true; 
        this.enviarForm();
    }
    console.log('mostrarDiv = '+this.mostrarDiv);
  }
  seleccionarBoton(claseBoton: string): void {
    this.botonSeleccionado = claseBoton;
  }

  ocultarBotones() {
    this.loading.set(false);
    this.mostrarDiv = false; 
    this.mostrarDiv2 = false;
    this.mostrarForm = true;
    console.log('mostrarDiv = '+this.mostrarDiv);
  }

  enviarForm(event?: Event): void {
    event?.preventDefault();
    this.confirmarProductoPendiente();

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (this.loading()) return;

    const formValues = this.formulario.getRawValue();
    this.loading.set(true);
    this.mensajeEstado = '';
    this.mensajeEsError = false;
    console.log('Formulario enviado:', formValues);

    this.addlinkpagoService.enviarFormulario(formValues).subscribe({
      next: (response) => {
        console.log('Formulario enviado exitosamente:', response);

        if (response?.success !== true) {
          this.loading.set(false);
          this.mostrarMensajeError(
            response?.message || response?.mensaje || 'No fue posible crear el link de pago.'
          );
          return;
        }

        const tipoNotificacion = String(formValues.tipoNoti);
        const formUrl = response?.payOrderResponse?.formUrl
          || response?.data?.payOrderResponse?.formUrl
          || response?.formUrl
          || '';

        if (tipoNotificacion === '2') {
          this.enviarSMS(formUrl, formValues);
        } else if (tipoNotificacion === '3') {
          this.loading.set(false);
          this.enviarEmail(formUrl, formValues);
        } else {
          this.loading.set(false);
          this.mostrarDetalleLink(formUrl);
        }
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error al enviar formulario:', error);
        this.mostrarMensajeError('No fue posible crear el link de pago. Intenta nuevamente.');
      }
    });
  }

  enviarSMS(formUrl: string, formValues: FormularioData): void {
    const datosSMS = this.crearDatosNotificacion(formUrl, formValues, formValues.tel);

    this.addlinkpagoService.enviarSMS(datosSMS).subscribe({
      next: (response) => {
        this.loading.set(false);
        console.log('SMS enviado exitosamente:', response);
        this.mensajeEsError = false;
        this.mensajeEstado = 'Link creado con éxito, revisa tus mensajes para ver el link a pagar.';

        window.setTimeout(() => {
          void this.router.navigate(['/pago_distancia']);
        }, 5000);
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error al enviar SMS:', error);
        this.mostrarMensajeError('El link fue creado, pero no fue posible enviar el SMS.');
      }
    });
  }

  private mostrarMensajeError(mensaje: string): void {
    this.mensajeEsError = true;
    this.mensajeEstado = mensaje;
  }

  private mostrarDetalleLink(formUrl: string): void {
    this.linkPago = formUrl;
    this.codigoBoton = this.generarCodigoBoton(formUrl);
    this.textoCopiado = '';
    this.mostrarForm = false;
    this.mostrarDiv = false;
    this.mostrarDiv2 = true;
  }

  async copiarLink(): Promise<void> {
    await this.copiarTexto(this.linkPago, 'Link copiado');
  }

  async copiarCodigo(): Promise<void> {
    await this.copiarTexto(this.codigoBoton, 'Código copiado');
  }

  compartirWhatsApp(): void {
    const texto = encodeURIComponent(`Realiza tu pago en el siguiente link: ${this.linkPago}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer');
  }

  compartirEmail(): void {
    const asunto = encodeURIComponent('Link de pago Kashpay');
    const cuerpo = encodeURIComponent(`Realiza tu pago en el siguiente link: ${this.linkPago}`);
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
  }

  volverFormulario(): void {
    this.mostrarDiv2 = false;
    this.mostrarDiv = false;
    this.mostrarForm = true;
  }

  private async copiarTexto(texto: string, mensaje: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.textoCopiado = mensaje;
      window.setTimeout(() => this.textoCopiado = '', 2000);
    } catch (error) {
      console.error('No fue posible copiar el texto:', error);
      this.mostrarMensajeError('No fue posible copiar el texto al portapapeles.');
    }
  }

  private generarCodigoBoton(formUrl: string): string {
    const estilos: Record<string, string> = {
      'btn-azul': 'color:#fff;background:#243247;border-radius:12px;',
      'btn-azul-degradado': 'color:#fff;background:linear-gradient(135deg,#243247,#446482);border-radius:12px;',
      'btn-blanco': 'color:#243247;background:#fff;border:1px solid #d1dbe9;border-radius:12px;',
      'btn-blanco-sombra': 'color:#243247;background:#fff;border-radius:12px;box-shadow:0 12px 24px rgba(35,50,77,.16);',
      'btn-azul-redondo': 'color:#fff;background:#243247;border-radius:999px;',
      'btn-blanco-redondo': 'color:#243247;background:#fff;border:1px solid #d1dbe9;border-radius:999px;',
      'btn-blanco-sombra-redondo': 'color:#243247;background:#fff;border-radius:999px;box-shadow:0 12px 24px rgba(35,50,77,.16);'
    };
    const estiloBoton = estilos[this.botonSeleccionado] || estilos['btn-azul'];
    const marcasUrl = new URL('pagosDistancia/Marcas.png', document.baseURI).toString();

    return `<div style="max-width:640px;margin:auto;text-align:center;">\n` +
      `  <a href="${formUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:14px 20px;text-decoration:none;font-weight:700;${estiloBoton}">Pagar con Kash</a>\n` +
      `  <p>Débito | crédito | efectivo | SPEI</p>\n` +
      `  <img style="width:100%;padding:15px 0;" src="${marcasUrl}" alt="Formas de pago">\n` +
      `</div>`;
  }

  enviarEmail(formUrl: string, formValues: FormularioData): void {
    const datosEmail = this.crearDatosNotificacion(formUrl, formValues, formValues.email);

    this.addlinkpagoService.enviarEmail(datosEmail).subscribe({
      next: (response) => {
        console.log('Email enviado exitosamente:', response);
      },
      error: (error) => {
        console.error('Error al enviar email:', error);
      }
    });
  }

  private crearDatosNotificacion(
    formUrl: string,
    formValues: FormularioData,
    orderingAcount: string
  ): NotificacionPagoData {
    return {
      orderingName: `${formValues.nombre} ${formValues.aPaterno} ${formValues.aMaterno}`.trim(),
      description: formValues.concepto,
      nameCommerce: localStorage.getItem('userName') || '',
      amount: String(formValues.monto),
      alphanumericReference: formValues.refCom,
      ticketMessage: formUrl,
      orderingAcount,
      commerceId: localStorage.getItem('entitySonID') || '',
      dateHourTransaction: new Date().toISOString(),
      adicional: formValues.tel
    };
  }

  
}


  
