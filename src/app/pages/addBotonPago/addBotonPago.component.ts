import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-add-boton-pago',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './addBotonPago.component.html',
  styleUrl: './addBotonPago.component.css'
})
export class AddBotonPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  botonSeleccionado = '';
  mostrarDetalle = false;
  urlNegocio = '';
  codigoBoton = '';
  mensajeError = '';
  mensajeCopiado = '';

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const params = new URLSearchParams();

    for (const key of ['email', 'validate', 'ordering']) {
      const value = queryParams.get(key);
      if (value) params.set(key, value);
    }

    if (queryParams.has('isMovil')) params.set('isMovil', '0');
    this.urlNegocio = `${window.location.origin}/linkNegocio?${params.toString()}`;
  }

  seleccionarBoton(clase: string): void {
    this.botonSeleccionado = clase;
  }

  generarBoton(): void {
    this.mensajeError = '';

    if (!this.isValidUrl(this.urlNegocio)) {
      this.mensajeError = 'El texto ingresado no es una URL válida.';
      return;
    }

    const marcasUrl = `${window.location.origin}/pagosDistancia/Marcas.png`;
    this.codigoBoton = [
      '<div class="panel pn">',
      '  <div class="row">',
      '    <div class="col-md-2 mb-5"></div>',
      '    <div class="col-md-8 mb-5">',
      '      <div class="col-md-12">',
      `        <a id="btn-pago-code" href="${this.urlNegocio}" class="pull-right btn-block btn-opcion btn ${this.botonSeleccionado}">Pagar con Kash</a>`,
      '      </div>',
      '      <div class="col-md-12">',
      '        <div style="height:15px;"></div>',
      '        <p class="text-center">Débito | Crédito | Efectivo | SPEI</p>',
      '      </div>',
      '      <div class="col-md-12">',
      `        <img style="width:100%;padding:15px 0;" src="${marcasUrl}" alt="Métodos de pago">`,
      '      </div>',
      '    </div>',
      '    <div class="col-md-2 mb-5"></div>',
      '  </div>',
      '</div>'
    ].join('\n');

    this.mostrarDetalle = true;
  }

  async copyClipboard(): Promise<void> {
    await this.copyText(this.codigoBoton, 'Código copiado');
  }

  async copyLink(): Promise<void> {
    await this.copyText(this.urlNegocio, 'Link copiado');
  }

  regresarFormulario(): void {
    this.mostrarDetalle = false;
    this.mensajeCopiado = '';
  }

  private async copyText(value: string, successMessage: string): Promise<void> {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const bridge = document.createElement('textarea');
      bridge.value = value;
      bridge.style.position = 'fixed';
      bridge.style.opacity = '0';
      document.body.appendChild(bridge);
      bridge.select();
      document.execCommand('copy');
      bridge.remove();
    }

    this.mensajeCopiado = successMessage;
    window.setTimeout(() => this.mensajeCopiado = '', 1800);
  }

  btnEmail(): void {
    const texto = this.getShareText();
    window.location.href = `mailto:correo@ejemplo.com?subject=${encodeURIComponent('Pago a distancia')}&body=${encodeURIComponent(texto)}`;
  }

  btnWApp(): void {
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(this.getShareText())}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  regresar(): void {
    window.history.back();
  }

  isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  saveAs(uri: string, filename: string): void {
    const link = document.createElement('a');

    if (typeof link.download === 'string') {
      link.href = uri;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    window.open(uri, '_blank', 'noopener,noreferrer');
  }

  private getShareText(): string {
    return `*Código HTML del Link*\n\n${this.codigoBoton}\n\n*Solo copia y pega el texto anterior en la web que lo necesites*`;
  }
}
