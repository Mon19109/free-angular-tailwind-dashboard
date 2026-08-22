import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { NuevoLinkPagoService } from '../../services/nuevoLinkPago.service';

interface CatalogOption {
  value: number | string;
  label: string;
}

@Component({
  selector: 'app-nuevo-link-pago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './nuevoLinkPago.component.html',
  styleUrls: ['./nuevoLinkPago.component.css']
})
export class NuevoLinkPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly nuevoLinkPagoService = inject(NuevoLinkPagoService);

  readonly referencia = this.route.snapshot.queryParamMap.get('referencia') || '';
  readonly formulario = this.fb.group({
    tel: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    email: ['', [Validators.required, Validators.email]],
    tipoNotificacion: ['', Validators.required],
    nombre: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    referenciaComercio: ['', Validators.required],
    referenciaUno: ['', Validators.required],
    referenciaDos: ['', Validators.required],
    concepto: ['', Validators.required],
    fechaVencimiento: ['', Validators.required],
    metodoPago: ['', Validators.required],
    monto: ['', [Validators.required, Validators.min(0.01)]],
    msi: [false],
    propina: [false],
    usuario: [''],
    sirioID: [''],
    id: [''],
    statusID: [''],
    orderType: [''],
    orderingAccount: ['']
  });

  tiposNotificacion: CatalogOption[] = [];
  metodosPago: CatalogOption[] = [];
  productos: string[] = [];
  productoEntrada = '';
  orden: any = null;
  cargando = true;
  mensajeError = '';
  actualizando = false;
  mensajeResultado = '';
  resultadoEsError = false;

  ngOnInit(): void {
    if (!this.referencia) {
      this.cargando = false;
      this.mensajeError = 'No se proporcionó una referencia de orden.';
      return;
    }

    forkJoin({
      link: this.nuevoLinkPagoService.obtenerLink(this.referencia),
      notificaciones: this.nuevoLinkPagoService.obtenerTiposNotificacion(),
      metodos: this.nuevoLinkPagoService.obtenerMetodosPago()
    }).subscribe({
      next: ({ link, notificaciones, metodos }) => {
        this.orden = this.normalizarOrden(link);
        this.tiposNotificacion = this.normalizarCatalogo(
          notificaciones,
          'notificationTypeID'
        );
        this.metodosPago = this.normalizarCatalogo(metodos, 'paymentMethodID');
        this.cargarFormulario(this.orden);
        this.cargando = false;
      },
      error: error => {
        console.error('Error al cargar el link para editar:', error);
        this.cargando = false;
        this.mensajeError = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible cargar la información del link.';
      }
    });
  }

  agregarProducto(event?: KeyboardEvent): void {
    if (event && event.key !== 'Enter' && event.key !== ',') return;
    event?.preventDefault();

    const producto = this.productoEntrada.trim();
    if (producto && !this.productos.some(item => item.toLowerCase() === producto.toLowerCase())) {
      this.productos = [...this.productos, producto];
    }
    this.productoEntrada = '';
  }

  eliminarProducto(producto: string): void {
    this.productos = this.productos.filter(item => item !== producto);
  }

  continuar(): void {
    this.agregarProducto();
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (this.actualizando) return;

    this.actualizando = true;
    this.mensajeResultado = '';
    this.resultadoEsError = false;

    this.nuevoLinkPagoService
      .editarLink(this.formulario.getRawValue(), this.productos)
      .subscribe({
        next: response => {
          this.actualizando = false;

          if (response?.success === false) {
            this.resultadoEsError = true;
            this.mensajeResultado = response?.message
              || response?.mensaje
              || 'No fue posible actualizar el link de pago.';
            return;
          }

          this.mensajeResultado = 'Link de pago actualizado correctamente.';
        },
        error: error => {
          console.error('Error al actualizar el link de pago:', error);
          this.actualizando = false;
          this.resultadoEsError = true;
          this.mensajeResultado = error?.error?.message
            || error?.error?.mensaje
            || 'No fue posible actualizar el link de pago.';
        }
      });
  }

  private cargarFormulario(orden: any): void {
    if (!orden) {
      this.mensajeError = 'No se encontró información para la orden solicitada.';
      return;
    }

    this.productos = (orden.products || [])
      .map((producto: any) => String(producto?.description || '').trim())
      .filter(Boolean);

    this.formulario.patchValue({
      tel: orden.customerInfo?.phone1 || '',
      email: orden.customerInfo?.email || '',
      tipoNotificacion: String(orden.notificationType?.notificationTypeID ?? ''),
      nombre: orden.customerInfo?.firstName || '',
      apellidoPaterno: orden.customerInfo?.lastName || '',
      apellidoMaterno: orden.customerInfo?.middleName || '',
      referenciaComercio: orden.payInfo?.reference || '',
      referenciaUno: orden.referenceOne || '',
      referenciaDos: orden.referenceTwo || '',
      concepto: orden.payInfo?.description || '',
      fechaVencimiento: this.normalizarFecha(orden.payInfo?.expiration),
      metodoPago: String(orden.paymentMethod?.paymentMethodID ?? ''),
      monto: String(orden.amount ?? ''),
      msi: Boolean(orden.msi),
      propina: Boolean(orden.tip),
      usuario: orden.user || '',
      sirioID: orden.sirioID || '',
      id: String(orden.id ?? ''),
      statusID: String(orden.status?.statusID ?? orden.estatus?.statusID ?? ''),
      orderType: String(orden.orderType?.id ?? ''),
      orderingAccount: orden.orderingAccount || ''
    });
  }

  private normalizarOrden(response: any): any {
    return response?.rows?.order
      ?? response?.data?.order
      ?? response?.order
      ?? response?.data
      ?? response;
  }

  private normalizarCatalogo(response: any, idKey: string): CatalogOption[] {
    const lista = Array.isArray(response)
      ? response.flatMap(item => Array.isArray(item) ? item : [item])
      : response?.data ?? response?.rows ?? [];

    return (Array.isArray(lista) ? lista : [lista]).filter(Boolean).map((item: any) => ({
      value: item[idKey] ?? item.id ?? '',
      label: item.description ?? item.descripcion ?? item.value ?? ''
    }));
  }

  private normalizarFecha(value: unknown): string {
    const fecha = String(value ?? '').trim();
    const iso = fecha.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];

    const meses: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
      julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    const texto = fecha.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
    if (!texto || !meses[texto[2]]) return '';

    return `${texto[3]}-${meses[texto[2]]}-${texto[1].padStart(2, '0')}`;
  }
}
