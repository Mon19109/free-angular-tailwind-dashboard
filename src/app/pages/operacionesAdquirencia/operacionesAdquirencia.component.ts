import { Component, OnInit , inject} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperacionesAdquirenciaService } from '../../services/operacionesadquirencia.service';

@Component({
  selector: 'app-operacionesAdqui',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './operacionesAdquirencia.component.html',
  styleUrls: ['./operacionesAdquirencia.component.css']
})
export class OperacionesAdquirenciaComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = [];
  operaciones: any[] = [];

entidades:any[] = [];
sucursales:any[] = [];
cajas:any[] = [];
clasificaciones:any[] = [];



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
  tipoOperacion: [''],
  estatus: [''],
  fechaInicio: [''],
  fechaFin: ['']
});

  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
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
    // Cargar cuentas
    this.opeAdquiService.obtenerCuentas().subscribe({
      next: (data) => {
        this.cuentas = data;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
      }
    });

    // Cargar tipos de operación
   this.cargarTiposOperacion();


this.formulario.get('cuenta')?.valueChanges.subscribe(valor => {

  console.log('SUBAFILIADO:', valor);

  if (!valor) return;

  this.opeAdquiService
    .getEntidades(Number(valor))
    .subscribe({

     next: (resp:any) => {

  console.log('ENTIDADES RESP:', resp);

  this.entidades = resp.entitiesResponse || [];

},

      error: (err) => {

        console.error('ERROR ENTIDADES:', err);

      }

    });

});

this.formulario.get('entidad')?.valueChanges.subscribe(entidad => {

  const subafiliado =
  this.formulario.get('cuenta')?.value;

  if (!subafiliado || !entidad) return;

  this.opeAdquiService
    .getSucursales(subafiliado, entidad)
    .subscribe({

      next:(resp:any)=>{

        this.sucursales =
        resp.rows || [];

      }

    });

});

this.formulario.get('sucursal')?.valueChanges.subscribe(idTerminal => {

  if (!idTerminal) return;

  this.opeAdquiService
    .getCajas(idTerminal)
    .subscribe({

      next:(resp:any)=>{

        this.cajas =
        resp.rows || [];

      }

    });

});


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

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
      // Aquí puedes llamar a otro servicio para enviar los datos
      this.opeAdquiService.enviarFormulario(formValues).subscribe({
        next: (response) => {
          this.operaciones = response.operations || [];
this.mostrarResultados = true;
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
    this.opeAdquiService.obtenerTiposOperacion().subscribe({
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
  }

  
}


  