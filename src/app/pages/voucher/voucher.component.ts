import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoucherService } from '../../services/voucher.service';
import { PaymentHeaderComponent } from '../../shared/layout/payment-header/payment-header.component';

@Component({
  selector: 'app-voucher',
  standalone: true,
  imports: [CommonModule, PaymentHeaderComponent],
  templateUrl: './voucher.component.html',
  styleUrl: './voucher.component.css'
})
export class VoucherComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly voucherService = inject(VoucherService);
  private temporizadorFinalizacion?: ReturnType<typeof setTimeout>;

  orden: any = null;
  cargando = true;
  descargandoVoucher = false;
  mensajeError = '';

  get estaPagada(): boolean {
    return String(this.orden?.status?.description || '').toUpperCase() === 'PAGADA';
  }

  get estaCancelada(): boolean {
    return Number(this.orden?.status?.statusID) === 7;
  }

  ngOnInit(): void {
    const reference = this.route.snapshot.queryParamMap.get('reference') || '';

    if (!reference) {
      this.cargando = false;
      this.mensajeError = 'No se proporcionó la referencia del pago.';
      return;
    }

    this.voucherService.obtenerOrden(reference).subscribe({
      next: respuesta => {
        this.orden = respuesta?.rows?.order
          ?? respuesta?.data?.order
          ?? respuesta?.order
          ?? respuesta?.data
          ?? respuesta;
        this.cargando = false;

        if (!this.orden) {
          this.mensajeError = 'No se encontró información para la referencia indicada.';
          return;
        }

        if (this.estaPagada) this.descargarVoucher(reference);
      },
      error: error => {
        this.cargando = false;
        this.mensajeError = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible consultar el estado del pago.';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.temporizadorFinalizacion) {
      clearTimeout(this.temporizadorFinalizacion);
    }
  }

  downloadBase64AsPdf(base64String: string, fileName = 'ticket.pdf'): void {
    const base64 = base64String.includes(',')
      ? base64String.substring(base64String.indexOf(',') + 1)
      : base64String;

    try {
      const binary = atob(base64.replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const downloadLink = document.createElement('a');

      downloadLink.href = objectUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      this.mensajeError = 'No fue posible generar el archivo PDF del voucher.';
    }
  }

  finalizarPago(): void {
    const success = true;
    const message = 'Pago Exitoso';
    const nativeWindow = window as Window & {
      Android?: { onPaymentFinished?: (success: boolean, message: string) => void };
      webkit?: {
        messageHandlers?: {
          onPaymentFinished?: { postMessage: (data: { success: boolean; message: string }) => void };
        };
      };
    };

    nativeWindow.Android?.onPaymentFinished?.(success, message);
    nativeWindow.webkit?.messageHandlers?.onPaymentFinished?.postMessage({ success, message });
  }

  private descargarVoucher(reference: string): void {
    this.descargandoVoucher = true;

    this.voucherService.obtenerVoucher(reference).subscribe({
      next: respuesta => {
        this.descargandoVoucher = false;

        if (respuesta?.success === true && respuesta.voucher) {
          this.downloadBase64AsPdf(respuesta.voucher, 'ticket.pdf');
          this.temporizadorFinalizacion = setTimeout(() => this.finalizarPago(), 5000);
          return;
        }

        this.mensajeError = respuesta?.message || respuesta?.mensaje || 'Algo salió mal al obtener el voucher.';
      },
      error: error => {
        this.descargandoVoucher = false;
        this.mensajeError = error?.error?.message
          || error?.error?.mensaje
          || 'Algo salió mal al obtener el voucher.';
      }
    });
  }
}
