import { Component, OnInit , inject} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AddLinkPagoService } from '../../services/addlinkpago.service';
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
export class AddLinkPagoComponent implements OnInit {
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
    tipoNoti = [
        { value: '1', label: 'URL (Página web)' },
        { value: '2', label: 'SMS' },
        { value: '3', label: 'Correo Electrónico' }
    ];

    tipoPago = [
        { value: '2', label: 'Transferencia' },
        { value: '3', label: 'E-Commerce' },
        { value: '6', label: 'Mixto' }
    ];
    selectedOptionPago = '';
    selectedOptionNoti = '';
    dateValue: any;
    timeValue = '';
    cardNumber = '';
    seleccionados: number[] = [];
  
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

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    
  }

  
  handleSelectChangePago(value: string) {
    this.selectedOptionPago = value;
    console.log('Selected value:', value);
  }
  handleSelectChangeNoti(value: string) {
    this.selectedOptionNoti = value;
    console.log('Selected value:', value);
  }
  handleDateChange(event: any) {
    this.dateValue = event;
    console.log('Date changed:', event);
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

  
}


  