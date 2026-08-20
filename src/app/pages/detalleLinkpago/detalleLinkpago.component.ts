import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-detalle-linkpago',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './detalleLinkpago.component.html',
  styleUrls: ['./detalleLinkpago.component.css']
})
export class DetalleLinkPagoComponent {
  private readonly route = inject(ActivatedRoute);

  readonly referencia = this.route.snapshot.queryParamMap.get('referencia') || '';
}
