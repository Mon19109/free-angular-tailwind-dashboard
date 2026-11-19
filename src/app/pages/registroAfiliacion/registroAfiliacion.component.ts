
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-registro-afiliacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registroAfiliacion.component.html',
  styleUrls: ['./registroAfiliacion.component.css']
})
export class RegistroAfiliacionComponent implements OnInit {
  referenciaComercio = '';
  nombreComercio = '';

  afiliacionProsa = '';
  giroProsa = '';
  afiliacionAmex = '';
  giroAmex = '';

 constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.referenciaComercio =
      this.route.snapshot.queryParamMap.get('ref') ?? '';

    const nombre = history.state?.nombreComercio;
    this.nombreComercio =
      typeof nombre === 'string' ? nombre : '';
  }

}
