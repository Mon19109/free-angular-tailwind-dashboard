import { Component } from '@angular/core';

@Component({
  selector: 'app-manuales',
  standalone: true,
  templateUrl: './manuales.component.html',
  styleUrls: ['./manuales.component.css']
})
export class ManualesComponent {
  webhook = {
    url: 'https://apiquality.brio.lat/redkash-proxy/api/red-kash-transaction',
    protocolo: 'POST',
    tipoSsl: 'Mutua SSL',
    fechaAlta: '02 Mar 2021'
  };
}
