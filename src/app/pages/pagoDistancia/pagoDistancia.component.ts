import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, UserSessionData } from '../../services/auth.service';
import { PagoDistanciaService,  } from '../../services/pagoDistancia.service';

@Component({
  selector: 'app-tarjeta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pagoDistancia.component.html',
  styleUrls: ['./pagoDistancia.component.css']
})
export class PagoDistanciaComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tarjeta: string = '';

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