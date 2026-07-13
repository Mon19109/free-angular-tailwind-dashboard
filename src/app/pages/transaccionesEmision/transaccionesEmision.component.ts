import { Component, OnInit , inject} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TransaccionesEmisionService } from '../../services/transaccionesemision.service';
//import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';
import { Validators } from '@angular/forms';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';


@Component({
  selector: 'app-operacionesEmi',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerComponent],
  templateUrl: './transaccionesEmision.component.html',
  styleUrls: ['./transaccionesEmision.component.css']
})
export class TransaccionesEmisionComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = []; 
  operaciones: any[] = [];
  estatusOptions: any[] = [];
  /*estatusOptions = [
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
  ];*/

  opciones = [
    { id: 1, nombre: 'Opción 1' },
    { id: 2, nombre: 'Opción 2' },
    { id: 3, nombre: 'Opción 3' },
    { id: 4, nombre: 'Opción 4' }
  ];
  
  private transEmiService = inject(TransaccionesEmisionService);
  
  seleccionados: number[] = [];
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      cuenta: [''],
      estatus: [''],
     email: ['', Validators.email],
      tel: [
 '',
 [
   Validators.pattern(/^[0-9]{10}$/)
 ]
],
      numAuto: [''],
      monto: [''],
      idEntidad: [''],
      tipoOperacion: [''],
      fechaInicio: [''],
      fechaFin: ['']
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  onFechaInicioChange(event: any) {
    this.formulario.patchValue({
      fechaInicio: event.dateStr
    });
  }

  onFechaFinChange(event: any) {
    this.formulario.patchValue({
      fechaFin: event.dateStr
    });
  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.transEmiService.obtenerCuentas().subscribe({
      next: (data) => {
        this.cuentas = data;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
      }
    });

    // Cargar tipos de operación
    this.transEmiService.obtenerTiposOperacion().subscribe({
      next: (data) => {
        this.tiposOperacion = data;
      },
      error: (error) => {
        console.error('Error al cargar tipos de operación:', error);
      }
    });

    // Cargar estatus
   this.transEmiService.obtenerStatus().subscribe({
  next: (data: any) => {

    this.estatusOptions = data.map((item: any) => ({
      value: item.idStatus,
      label: item.statusDescription
    }));

  },
  error: (error) => {
    console.error('Error al cargar estatus:', error);
  }
});
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      this.transEmiService.enviarFormulario(formValues).subscribe({
      
       
        next: (response) => {
          console.log('Formulario enviado exitosamente:', response);
          this.operaciones = response.content || response.rows?.content || response.rows || [];
          console.log('operaciones enviado exitosamente:', this.operaciones);
          // Aquí puedes agregar lógica adicional, como mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al enviar formulario:', error);
        }
      });
    }
  }
  
soloNumeros(event: KeyboardEvent) {

  const charCode = event.which || event.keyCode;

  if (charCode < 48 || charCode > 57) {
    event.preventDefault();
  }

}
  cargarTiposOperacion(): void {
    this.transEmiService.obtenerTiposOperacion().subscribe({
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
  this.formulario.reset();
  this.operaciones = [];
}
  
}


  
