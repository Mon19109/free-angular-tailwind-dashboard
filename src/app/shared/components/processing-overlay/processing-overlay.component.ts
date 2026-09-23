import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-processing-overlay',
  standalone: true,
  template: `
    <div class="processing-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div class="processing-card">
        <span class="processing-spinner" aria-hidden="true"></span>
        <strong>{{ texto }}</strong>
        <small>{{ descripcion }}</small>
      </div>
    </div>
  `,
  styleUrls: ['./processing-overlay.component.css']
})
export class ProcessingOverlayComponent {
  @Input() texto = 'Registrando cliente...';
  @Input() descripcion = 'Estamos validando la información. Espera un momento.';
}
