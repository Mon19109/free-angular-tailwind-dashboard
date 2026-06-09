import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { MultiSelectComponent, Option }
from '../../shared/components/form/multi-select/multi-select.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';

//import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';

@Component({
  selector: 'app-operacionesEmi',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MultiSelectComponent, DatePickerComponent],
  templateUrl: './operacionesEmision.component.html',
  styleUrls: ['./operacionesEmision.component.css']
})
export class OperacionesEmisionComponent implements OnInit {
  formulario: FormGroup;
  //cuentas: any[] = [];
  entidades: any[] = [];
  tiposOperacion: any[] = [];
  operaciones: any[] = [];

  tipoOperacionOptions: Option[] = [];
  estatusMultiOptions: Option[] = [];
defaultEstatus: string[] = ['15', '31'];
defaultTipoOperacion = ['11', '22', '24', '30'];

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


  private  operaEmiService = inject(OperacionesEmisionService);
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
  cuenta: [''],
  estatus: [[]],
  tipoOperacion: [[]],
  fechaInicio: [''],
  fechaFin: ['']
});
  }

  ngOnInit(): void {

  this.estatusMultiOptions = this.estatusOptions.map(item => ({
    value: item.value,
    text: item.label
  }));

  this.cargarDatosIniciales();
}

  cargarDatosIniciales(): void {
    // Cargar cuentas
   this.operaEmiService.obtenerCuentas().subscribe({
  next: (data) => {
    this.entidades = data;
    console.log('Entidades:', data);
  }
});

   // Cargar tipos de operación
this.operaEmiService.obtenerTiposOperacion().subscribe({
  next: (data: any) => {

    this.tiposOperacion = data;

    this.tipoOperacionOptions = data.map((tipo: any) => ({
      value: String(tipo.idOperationType),
      text: tipo.name
    }));
    this.defaultTipoOperacion = this.tipoOperacionOptions
  .slice(0, 3)
  .map(x => x.value);
  

  },
  error: (error) => {
    console.error('Error al cargar tipos de operación:', error);
  }
});
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      this.operaEmiService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          console.log('Formulario enviado exitosamente:', response);
          this.operaciones = response.operations || [];

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
    this.operaEmiService.obtenerTiposOperacion().subscribe({
      next: (response: any) => {
        // Acceder a catOperationTypes dentro de la respuesta
        this.tiposOperacion = response.catOperationTypes || [];
        console.log('Tipos de operación:', this.tiposOperacion);
      },
      error: (error) => {
        console.error('Error:', error);
        this.tiposOperacion = [];
      }
    });
  }

  limpiarFormulario(): void {

  this.formulario.reset({
    cuenta: '',
    estatus: [],
    tipoOperacion: [],
    fechaInicio: '',
    fechaFin: ''
  });

}

  
}


  