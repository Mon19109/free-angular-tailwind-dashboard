import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UsuariosService } from '../../services/usuarios.service';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerComponent],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  formulario: FormGroup;
  entidades: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = [];
  operaciones: any[] = [];
  usuarios: any[] = [];
  mostrarTabla = false;
  mensajeError = '';
  cargando = false;
  tipoBusquedaSeleccionado = '0';
  paginaActual = 1;
  totalPaginas = 1;
  paginas: number[] = [];

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

  private usuariosService = inject(UsuariosService);


  constructor(
    private fb: FormBuilder,
    //private usuariosService: UsuariosService
  ) {

    this.formulario = this.fb.group({
      entidad: [''],
      typeSearch: ['0'],
      value1F: [''],
      value2F: ['']
    });
  }

  ngOnInit(): void {

    this.cargarDatosIniciales();

    this.formulario.get('typeSearch')?.valueChanges.subscribe(tipo => {

      this.tipoBusquedaSeleccionado = tipo;

      this.formulario.patchValue({
        value1F: '',
        value2F: ''
      });

    });

  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.usuariosService.obtenerEntidades().subscribe({
      next: (data) => {
        this.entidades = data;
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
    console.log('Formulario ');
    console.log(this.formulario.value);

    this.cargando = true;
    this.mostrarTabla = false;
    this.mensajeError = '';

    this.usuariosService.enviarFormulario(this.formulario.value)
      .subscribe({

        next: (response) => {

          this.usuarios = response.content || [];
          this.totalPaginas =
            response.totalPages || 1;

          this.paginas =
            Array.from(
              { length: this.totalPaginas },
              (_, i) => i + 1
            );
          // this.cargando = false;

          if (this.usuarios.length > 0) {

            this.mostrarTabla = true;

          } else {

            this.mensajeError =
              'No se encontraron registros para los filtros seleccionados';

          }

        },

        error: () => {

          this.cargando = false;

          this.mensajeError =
            'Ocurrió un error al consultar la información';

        }

      });

  }

  cambiarPagina(page: number): void {

    this.paginaActual = page;

    this.usuariosService
      .enviarFormulario(
        this.formulario.value,
        this.paginaActual
      )
      .subscribe({

        next: (response) => {

          this.usuarios =
            response.content || [];

        }

      });

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

  onFechaInicioChange(event: any): void {

    this.formulario.patchValue({
      value1F: event.dateStr.split(' ')[0]
    });

  }

  onFechaFinChange(event: any): void {

    this.formulario.patchValue({
      value2F: event.dateStr.split(' ')[0]
    });

  }

/*
  reenviarToken(usuario: any): void {

    console.log(
      'Reenvio token',
      usuario
    );

  }

  actualizarCorreo(usuario: any): void {

    console.log(
      'Actualizar correo',
      usuario
    );

  }*/

  imprimir(): void {

    console.log('print');

  }

  exportarExcel(): void {

    console.log('Excel');

  }

  exportarPDF(): void {

    console.log('PDF');

  }

  limpiarFormulario(): void {

    this.formulario.reset({
      entidad: '',
      typeSearch: '0',
      value1F: '',
      value2F: ''
    });

    this.tipoBusquedaSeleccionado = '0';

    this.usuarios = [];

    this.mostrarTabla = false;

    this.mensajeError = '';

  }


  onAccionChange(accion: string, usuario: any): void {

  if (!accion) {
    return;
  }

  if (accion === 'token') {

    console.log('Reenvio token');
    console.log(usuario);

    // this.reenviarToken(usuario);

  }

  if (accion === 'correo') {

    console.log('Actualizar correo');
    console.log(usuario);

    // this.actualizarCorreo(usuario);

  }

}
}