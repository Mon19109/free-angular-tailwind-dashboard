import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DetalleLinkPagoService } from '../../services/detalleLinkpago.service';

@Component({
  selector: 'app-detalle-linkpago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detalleLinkpago.component.html',
  styleUrls: ['./detalleLinkpago.component.css']
})
export class DetalleLinkPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly detalleLinkPagoService = inject(DetalleLinkPagoService);

  readonly referencia = this.route.snapshot.queryParamMap.get('referencia') || '';
  orden: any = null;
  cargando = true;
  mensajeError = '';
  mensajeCopiado = '';

  ngOnInit(): void {
    if (!this.referencia) {
      this.cargando = false;
      this.mensajeError = 'No se proporcionó una referencia para consultar el link.';
      return;
    }

    this.detalleLinkPagoService.obtenerDetalle(this.referencia).subscribe({
      next: response => {
        this.orden = response?.rows?.order
          ?? response?.data?.order
          ?? response?.order
          ?? response?.data
          ?? response;
        this.cargando = false;

        if (!this.orden) {
          this.mensajeError = 'No se encontró información para el link solicitado.';
        }
      },
      error: error => {
        console.error('Error al consultar el detalle del link:', error);
        this.cargando = false;
        this.mensajeError = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible consultar el detalle del link.';
      }
    });
  }

  get descripcionEstatus(): string {
    return String(
      this.orden?.status?.description
      ?? this.orden?.estatus?.description
      ?? this.orden?.statusDescription
      ?? ''
    ).trim().toUpperCase();
  }

  get estatusVisible(): string {
    const estatus: Record<string, string> = {
      PAGADA: 'Pagado',
      CREADA: 'Pendiente de Pago',
      EXPIRADA: 'Expirado',
      CANCELADA: 'Cancelado'
    };

    return estatus[this.descripcionEstatus] || this.descripcionEstatus || 'Sin estatus';
  }

  get nombreCliente(): string {
    const cliente = this.orden?.customerInfo;
    return [cliente?.firstName, cliente?.lastName, cliente?.middleName]
      .filter(Boolean)
      .join(' ') || 'ND';
  }

  async copiarLink(): Promise<void> {
    const link = this.orden?.formUrl || '';
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      this.mensajeCopiado = 'Link copiado';
      window.setTimeout(() => this.mensajeCopiado = '', 2000);
    } catch (error) {
      console.error('No fue posible copiar el link:', error);
    }
  }

  compartirWhatsApp(): void {
    const texto = encodeURIComponent(`Realiza tu pago en el siguiente link: ${this.orden?.formUrl || ''}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer');
  }

  compartirCorreo(): void {
    const asunto = encodeURIComponent('Link de pago Kashpay');
    const cuerpo = encodeURIComponent(`Realiza tu pago en el siguiente link: ${this.orden?.formUrl || ''}`);
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
  }

  volver(): void {
    this.location.back();
  }
}
