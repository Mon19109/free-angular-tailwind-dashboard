import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UsuariosService } from '../../services/usuarios.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = [];
  operaciones: any[] = [];
  usuarios: any[] = [];
  typeSearchOptions = [
    { label: 'Rango de fecha', value: '0' },
    { label: 'Correo Electrónico', value: '1' },
    { label: 'Teléfono', value: '2' },
    { label: 'Estatus', value: '3' }
  ];

//$arraystatus = array('Activo','Bloqueado','Inactivo','Revisando','Verificado','Fallo envio SCUD',
// 'Pendiente por revisar core','Estatus diferente de verified','Fallo alta web','Rechazado por SCUD');
//$arraystatusid = array(1,3,14,18,19,20,21,22,23,24);
  estatusOptions = [
    { id: 1, nombre: 'Activo' },
    { id: 3, nombre: 'Bloqueado' },
    { id: 14, nombre: 'Inactivo' },
    { id: 18, nombre: 'Revisando' },
    { id: 19, nombre: 'Verificado' },
    { id: 20, nombre: 'Fallo envio SCUD' },
    { id: 21, nombre: 'Pendiente por revisar core' },
    { id: 22, nombre: 'Estatus diferente de verified' },
    { id: 23, nombre: 'Fallo alta web' },
    { id: 24, nombre: 'Rechazado por SCUD' }
  ];
  
  seleccionados: number[] = [];
  
  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }

  private  usuariosService = inject(UsuariosService);

  
  constructor(
    private fb: FormBuilder,
    //private usuariosService: UsuariosService
  ) {
    this.formulario = this.fb.group({
      cuenta: [''],
      estatus: [''],
      email: [''],
      tel: [''],
      numAuto: [''],
      monto: [''],
      entidad: [''],
      tipoOperacion: [''],
      fechaInicio: [''],
      fechaFin: ['']
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.usuariosService.obtenerCuentas().subscribe({
      next: (data) => {
        this.cuentas = data;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
      }
    });

    // Cargar tipos de operación
    /*this.usuariosService.obtenerTiposOperacion().subscribe({
      next: (data) => {
        this.tiposOperacion = data;
      },
      error: (error) => {
        console.error('Error al cargar tipos de operación:', error);
      }
    });

    // Cargar estatus
    this.transEmiService.obtenerStatus().subscribe({
      next: (data) => {
        this.estatus = data;
      },
      error: (error) => {
        console.error('Error al cargar estatus:', error);
      }
    });*/
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      this.usuariosService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          console.log('Formulario enviado exitosamente:', response);
          this.usuarios = response || [];

          console.log('usuarios enviado exitosamente:', this.usuarios);
          // Aquí puedes agregar lógica adicional, como mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al enviar formulario:', error);
        }
      });
    }
  }

  /*cargarTiposOperacion(): void {
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
  }*/

  limpiarFormulario(): void {
    this.formulario.reset();
  }

  
}