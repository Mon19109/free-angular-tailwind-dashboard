import { Component , inject, signal} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AddLinkPagoService } from '../../services/addlinkpago.service';
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
    mostrarDiv = false;
    mostrarForm = true;
    opcionSeleccionada = '';
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }

  private  addlinkpagoService = inject(AddLinkPagoService);
  
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
  parentClick(){
    console.log('ususususus');
  }

  ocultarBotones() {
    this.loading.set(false);
    this.mostrarDiv = false; 
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
    console.log('Formulario enviado:', formValues);

    this.addlinkpagoService.enviarFormulario(formValues).subscribe({
      next: (response) => {
        this.loading.set(false);
        console.log('Formulario enviado exitosamente:', response);
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error al enviar formulario:', error);
      }
    });
  }

  
}


  
