import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PreRegistroService,  } from '../../services/preregistro.service';
import { DefaultInputsComponent } from '../../shared/components/form/form-elements/default-inputs/default-inputs.component';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';
import { InputFieldComponent } from "../../shared/components/form/input/input-field.component";

@Component({
  selector: 'app-preregistro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LabelComponent,
    DefaultInputsComponent, DatePickerComponent, SelectComponent, InputFieldComponent],
  templateUrl: './preRegistro.component.html',
  styleUrls: ['./preRegistro.component.css']
})
// En tu componente
export class PreRegistroComponent {
    secciones = [
        { titulo: 'Descripción del comercio', contenido: 'Descripción del comercio', activo: false },
        { titulo: 'Datos Generales', contenido: 'Contenido de la segunda sección', activo: false },
        { titulo: 'Documentos', contenido: 'Contenido de la tercera sección', activo: false }
    ];
    niveles = [
        { value: '1', label: 'Subafiliado' },
        { value: '2', label: 'Entidad' },
        { value: '3', label: 'Sucursal' },
        { value: '3', label: 'Caja' },
        { value: '3', label: 'Reserva' }
    ];
    tComercio = [
        { value: '1', label: 'Empresa Grupo' },
        { value: '2', label: 'Persona física' }
    ];
  selectedOptionNivel = '';
  selectedOptiontComercio = '';


    toggleSeccion(index: number) {
      if (event) {
        event.preventDefault();
      }
        // Modo exclusivo: solo una sección abierta
        this.secciones.forEach((sec, i) => {
            sec.activo = i === index ? !sec.activo : false;
        });
    }

    handleSelectChangeNivel(value: string) {
      this.selectedOptionNivel = value;
      console.log('Selected value:', );
      //this.opcionSeleccionada = value
    }

    handleSelectChangeTComercio(value: string) {
      this.selectedOptiontComercio = value;
      console.log('Selected value:', );
      //this.opcionSeleccionada = value
    }

}
/*export class PreRegistroComponent  {
  sesionVar = localStorage;
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

  private  preRegistroService = inject(PreRegistroService);
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      tarjeta: [''],
      entidad: ['']
    });
  }

  /*ngOnInit(): void {
    this.cargarDatosIniciales();
  }*/

  /*cargarDatosIniciales(): void {

  }*/

  // En tu componente de Angular
/*  setupAccordion() {
      const headers = document.querySelectorAll('.accordion-header');
      
      headers.forEach(header => {
          header.addEventListener('click', () => {
              const content = header.nextElementSibling;
              content?.classList.toggle('hidden');
          });
      });
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const formValues = this.formulario.value;
      console.log('Formulario enviado:', formValues);
      
    }
  }
 
}*/