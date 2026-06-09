import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, UserSessionData } from '../../services/auth.service';
import { PagoDistanciaService,  } from '../../services/pagoDistancia.service';
import { DefaultInputsComponent } from '../../shared/components/form/form-elements/default-inputs/default-inputs.component';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';

import { InputFieldComponent } from '../../shared/components/form/input/input-field.component';
@Component({
  selector: 'app-tarjeta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,LabelComponent,
      DefaultInputsComponent,DatePickerComponent,SelectComponent,InputFieldComponent],
  templateUrl: './pagoDistancia.component.html',
  styleUrls: ['./pagoDistancia.component.css']
}) 
export class PagoDistanciaComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tarjeta: string = '';
  filtros = [
        { value: '1', label: 'Apellido Paterno' },
        { value: '2', label: 'Apellido Materno' },
        { value: '3', label: 'Nombre' },
        { value: '3', label: 'Concepto' },
        { value: '3', label: 'Correo Electrónico' },
        { value: '3', label: 'Monto' },
        { value: '3', label: 'Referencia del comercio' },
        { value: '3', label: 'Teléfono' },
        { value: '3', label: 'Fecha Expiración' }
    ];
  selectedOptionFil = '';
  dateValue='';
  
                                    

  private  pagoDistanciaService = inject(PagoDistanciaService);

  user: UserSessionData | null = null;
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      tarjeta: [''],
      entidad: ['']
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.pagoDistanciaService.obtenerCuentas().subscribe({
      next: (data) => {
        this.cuentas = data;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
      }
    });

  }

  handleSelectChangeFil(value: string) {
    this.selectedOptionFil = value;
    console.log('Selected value:', value);
    //this.opcionSeleccionada = value
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
      this.pagoDistanciaService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          console.log('Formulario enviado exitosamente:', response);
          this.tarjeta = response || [];

          //console.log('tarjeta enviado exitosamente:', this.operaciones);
          // Aquí puedes agregar lógica adicional, como mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al enviar formulario:', error);
        }
      });
    }
  }

  limpiarFormulario(): void {
    this.formulario.reset();
  }
 
}