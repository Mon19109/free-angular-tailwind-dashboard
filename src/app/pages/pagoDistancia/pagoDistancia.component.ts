import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  BusquedaPagoDistanciaData,
  FiltroPagoDistancia,
  PagoDistanciaService
} from '../../services/pagoDistancia.service';
import { LabelComponent } from '../../shared/components/form/label/label.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';

@Component({
  selector: 'app-tarjeta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,LabelComponent,
      DatePickerComponent],
  templateUrl: './pagoDistancia.component.html',
  styleUrls: ['./pagoDistancia.component.css']
}) 
export class PagoDistanciaComponent {
  formulario: FormGroup;
  readonly idRol = Number(localStorage.getItem('idRol') || 0);
  readonly mostrarCrearLink = [5, 6].includes(this.idRol);
  readonly mostrarBotonPago = [4, 5, 6].includes(this.idRol);
  ordenes: any[] = [];
  filtros = [
        { value: 'Apellido Paterno', label: 'Apellido Paterno' },
        { value: 'Apellido Materno', label: 'Apellido Materno' },
        { value: 'Nombre', label: 'Nombre' },
        { value: 'Concepto', label: 'Concepto' },
        { value: 'Correo Electrónico', label: 'Correo Electrónico' },
        { value: 'Monto', label: 'Monto' },
        { value: 'Referencia del comercio', label: 'Referencia del comercio' },
        { value: 'Teléfono', label: 'Teléfono' },
        { value: 'Fecha de expiración', label: 'Fecha de expiración' }
    ];
  selectedOptionFil = '';
  dateValue='';
  
                                    

  private  pagoDistanciaService = inject(PagoDistanciaService);

  readonly sesionVar = localStorage;
  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      fechaCreacion: [''],
      filtro: [''],
      busqueda: ['']
    });
  }

  handleSelectChangeFil(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedOptionFil = value;
    this.formulario.patchValue({ filtro: value });
  }
  handleDateChange(event: any) {
    this.dateValue = event?.dateStr ?? event ?? '';
    this.formulario.patchValue({ fechaCreacion: this.dateValue });
  }

  onSubmit(): void {
    if (this.formulario.valid) {
      const rawValue = this.formulario.getRawValue();
      const formValues: BusquedaPagoDistanciaData = {
        filtro: (rawValue.filtro || '') as FiltroPagoDistancia,
        busqueda: String(rawValue.busqueda || '').trim(),
        fechaCreacion: String(rawValue.fechaCreacion || '').trim()
      };

      this.pagoDistanciaService.buscarOrdenes(formValues).subscribe({
        next: (response) => {
          this.ordenes = this.normalizarOrdenes(response);
          console.log('Links encontrados:', this.ordenes);
        },
        error: (error) => {
          this.ordenes = [];
          console.error('Error al enviar formulario:', error);
        }
      });
    }
  }

  limpiarFormulario(): void {
    this.formulario.reset();
    this.ordenes = [];
    this.selectedOptionFil = '';
    this.dateValue = '';
  }

  private normalizarOrdenes(response: any): any[] {
    if (Array.isArray(response)) return response;

    const resultado = response?.orders
      ?? response?.data
      ?? response?.payOrders
      ?? response?.orderResponse
      ?? response?.content
      ?? [];

    return Array.isArray(resultado) ? resultado : [resultado];
  }
 
}
