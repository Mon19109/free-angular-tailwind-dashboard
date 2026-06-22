import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
//import { AuthService, UserSessionData } from '../../services/auth.service';
import { TarjetaService,  } from '../../services/tarjeta.service';

@Component({
  selector: 'app-tarjeta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tarjeta.component.html',
  styleUrls: ['./tarjeta.component.css']
})
export class TarjetaComponent implements OnInit {
  formulario: FormGroup;
  cuentas: any[] = [];
  tarjeta: string = '';

mostrarTarjeta = false;
mensaje = '';
datosTarjeta: any = null;

  cardNumberDisplay = '#### #### #### ####';
cardNameDisplay = '';


  private  tarjetaService = inject(TarjetaService);

 // user: UserSessionData | null = null;  
  constructor(
    private fb: FormBuilder
  ) {
    this.formulario = this.fb.group({
      tarjeta: [''],
      entidad: ['']
    });
  }

 ngOnInit(): void {

  const userData =
    localStorage.getItem('userData');

  if (userData) {
    this.user = JSON.parse(userData);
  }

  this.cargarDatosIniciales();

}
  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.tarjetaService.obtenerCuentas().subscribe({
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
      this.tarjetaService.enviarFormulario(formValues).subscribe({
       next: (response: any) => {

  console.log('Formulario enviado exitosamente:', response);

  this.tarjeta = response;

  if (response?.length > 0) {

    this.mostrarTarjeta = true;
    this.mensaje = '';

    const card = response[0];

    this.cardNumberDisplay =
      card.cardNumber ||
      card.pan ||
      '#### #### #### ####';

    this.cardNameDisplay =
      card.name ||
      card.cardHolderName ||
      '';

  } else {

    this.mostrarTarjeta = false;
    this.mensaje = 'Datos no encontrados';

  }

},
        error: (error) => {

  console.error('Error al enviar formulario:', error);

  this.mostrarTarjeta = false;

  this.mensaje = 'Datos no encontrados';

}
      });
    }
  }

  limpiarFormulario(): void {
    this.formulario.reset();
  }
 
}