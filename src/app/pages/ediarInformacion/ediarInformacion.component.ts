import { Component } from '@angular/core';
import { RegistroClienteComponent } from '../registroCliente/registroCliente.component';

@Component({
  selector: 'app-ediar-informacion',
  standalone: true,
  imports: [RegistroClienteComponent],
  templateUrl: './ediarInformacion.component.html',
  styleUrls: ['./ediarInformacion.component.css']
})
export class EdiarInformacionComponent {}
