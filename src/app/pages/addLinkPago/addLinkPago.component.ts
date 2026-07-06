import { Component , inject, signal} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AddLinkPagoService } from '../../services/addlinkpago.service';
//import { AuthService, UserSessionData } from '../../services/auth.service';
//import { TextAreaComponent } from '../../shared/components/form/input/text-area.component';
import { InputFieldComponent } from '../../shared/components/form/input/input-field.component';
import { DefaultInputsComponent } from '../../shared/components/form/form-elements/default-inputs/default-inputs.component';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';
import { CheckboxComponent } from '../../shared/components/form/input/checkbox.component';
//import { CheckboxComponentsComponent } from '../../shared/components/form/form-elements/checkbox-components/checkbox-components.component';


@Component({
  selector: 'app-addlinkpago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,LabelComponent,InputFieldComponent,
    DefaultInputsComponent,DatePickerComponent,SelectComponent,CheckboxComponent],
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
      nombre: [''],
      aPaterno: [''],
      aMaterno: [''],
      tel: [''],
      email: [''],
      tipoNoti: [''],
      tipoPago: [''],
      ref1: [''],
      ref2: [''],
      monto: [''],
      refCom: [''],
      concepto: [''],
      fechaVen: [''],
      propina: [''],
      msi: ['']

    });
  }
  
  handleSelectChangePago(value: string) {
    this.selectedOptionPago = value;
    console.log('Selected value:', value);
  }
  handleSelectChangeNoti(value: string) {
    this.selectedOptionNoti = value;
    console.log('Selected value:', value);
    //this.opcionSeleccionada = value
  }
  handleDateChange(event: any) {
    this.dateValue = event;
    console.log('Date changed:', event);
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
    console.log('selectedOptionNoti = '+this.selectedOptionNoti);
    if (this.selectedOptionNoti == '1') {
        this.mostrarDiv = true;
        this.mostrarForm = false;
    }else{
        this.mostrarDiv = false; 
        this.mostrarForm = true; 
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

  enviarForm(event: any){
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
    }
  }

  
}


  
