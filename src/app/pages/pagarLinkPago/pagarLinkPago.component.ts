import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PagarLinkPagoService } from '../../services/pagarlinkpago.service';
import { PaymentHeaderComponent } from '../../shared/layout/payment-header/payment-header.component';

@Component({
  selector: 'app-pagarLinkPago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule, PaymentHeaderComponent],
  templateUrl: './pagarLinkPago.component.html',
  styleUrls: ['./pagarLinkPago.component.css']
})
export class PagarLinkPagoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pagarLinkPagoService = inject(PagarLinkPagoService);

  readonly referencia = this.route.snapshot.queryParamMap.get('reference')
    || this.route.snapshot.queryParamMap.get('referencia')
    || '';
  readonly formulario = this.fb.group({
    amountPending: [''],
    nameCard: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    numCard: ['', [Validators.required, Validators.pattern(/^\d{4} \d{4} \d{4} \d{4}$/)]],
    vencimiento: ['', [Validators.required, validarVencimientoTarjeta]],
    ccv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
    pais: ['Mexico', [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
    cp: ['', [Validators.required, Validators.pattern(/^\d{1,5}$/)]],
    address: [''],
    ciudad: [''],
    estado: [''],
    meses: [0],
    propinaPorcentaje: [0],
    propina: [{ value: 0, disabled: true }],
    terminos: [false, Validators.requiredTrue]
  });

  orden: any = null;
  balance: any = null;
  cargando = true;
  mensajeError = '';
  tabActiva: 'tarjeta' | 'transferencia' = 'tarjeta';
  mostrarResumen = false;
  mostrarOpcionesPago = false;
  mensajeCopiado = '';
  validandoBin = false;
  mensajeBin = '';
  msiDisponibles: Array<{ meses: number; descripcion: string }> = [];
  enviandoPago = false;
  mensajePago = '';
  errorPago = '';
  tarjetasGuardadas: Array<{ token: string; etiqueta: string }> = [];
  tarjetaSeleccionada = 'nueva';
  cargandoTarjetas = false;
  cargandoDetalleTarjeta = false;
  mensajeTarjetas = '';
  latitud = '';
  longitud = '';
  ip = '';
  errorIp = false;
  private merchantId = '';
  private detalleTarjeta: any = null;
  private detalleTarjetaSubscription?: Subscription;
  private validacionBinSubscription?: Subscription;
  private ultimoBinValidado = '';
  private temporizadorMonto?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.pagarLinkPagoService.obtenerIp().subscribe({
      next: response => { this.ip = response.ip; },
      error: () => { this.errorIp = true; }
    });

    this.pagarLinkPagoService.precargarUbicacion().subscribe(ubicacion => {
      this.latitud = ubicacion.latitud;
      this.longitud = ubicacion.longitud;
    });

    if (!this.referencia) {
      this.cargando = false;
      this.mensajeError = 'No se proporciono una referencia para consultar el link de pago.';
      return;
    }

    this.pagarLinkPagoService.obtenerOrden(this.referencia).subscribe({
      next: response => {
        this.orden = response?.rows?.order ?? response?.data?.order ?? response?.order ?? response?.data ?? response;
        this.cargando = false;
        if (String(this.orden?.status?.description || '').toUpperCase() === 'PAGADA') {
          this.abrirVoucher();
          return;
        }
        this.mostrarOpcionesPago = false;
        this.mostrarResumen = false;
        this.formulario.controls.terminos.setValue(false);
        this.formulario.patchValue({ amountPending: this.orden?.amountPending ?? this.orden?.amount ?? '' });
        const sirioId = String(this.orden?.sirioID ?? this.orden?.sirioId ?? '').trim();
        if (sirioId) {
          this.pagarLinkPagoService.obtenerBalance(sirioId).subscribe({
            next: balance => { this.balance = balance?.rows ?? balance?.data ?? balance; },
            error: () => { this.balance = null; }
          });
        }
        if (this.permiteTarjetasGuardadas) this.cargarTarjetas();
        if (!this.orden) this.mensajeError = 'No se encontro informacion para el link solicitado.';
      },
      error: error => {
        this.cargando = false;
        this.mensajeError = error?.error?.message || error?.error?.mensaje || 'No fue posible consultar el link de pago.';
      }
    });

    this.formulario.controls.propinaPorcentaje.valueChanges.subscribe(valor => {
      if (Number(valor) > 0) this.formulario.controls.propina.setValue(0, { emitEvent: false });
    });

    this.formulario.controls.amountPending.valueChanges.subscribe(() => {
      if (!this.esPagoMixto) return;
      if (this.temporizadorMonto) clearTimeout(this.temporizadorMonto);
      this.temporizadorMonto = setTimeout(() => this.revalidarBin(), 700);
    });
  }

  get nombreCliente(): string {
    const cliente = this.orden?.customerInfo;
    return [cliente?.firstName, cliente?.lastName, cliente?.middleName].filter(Boolean).join(' ') || 'ND';
  }

  get productos(): string {
    return (this.orden?.products || []).map((producto: any) => producto?.description).filter(Boolean).join(', ') || 'ND';
  }

  get fechaExpiracionVisible(): string {
    const valor = this.orden?.payInfo?.expiration;
    if (!valor) return 'ND';

    const texto = String(valor).trim();
    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) return texto;

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fecha);
  }

  get esPagoMixto(): boolean { return Number(this.orden?.paymentMethod?.paymentMethodID) === 6; }

  get permiteTarjetasGuardadas(): boolean {
    const registrar = this.orden?.customerInfo?.registerClient;
    return registrar === true || registrar === 1 || registrar === '1' || registrar === 'true';
  }

  get usaTarjetaGuardada(): boolean {
    return this.permiteTarjetasGuardadas && this.tarjetaSeleccionada !== 'nueva';
  }

  seleccionarTarjeta(event: Event): void {
    this.detalleTarjetaSubscription?.unsubscribe();
    this.validacionBinSubscription?.unsubscribe();
    this.tarjetaSeleccionada = (event.target as HTMLSelectElement).value;
    this.detalleTarjeta = null;
    this.cargandoDetalleTarjeta = false;
    this.mensajeTarjetas = '';
    this.mostrarOpcionesPago = false;
    this.mostrarResumen = false;
    const campos = ['nameCard', 'numCard', 'vencimiento', 'pais', 'cp', 'address', 'ciudad', 'estado'] as const;
    for (const campo of campos) {
      const control = this.formulario.controls[campo];
      if (this.usaTarjetaGuardada) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
    this.formulario.patchValue({
      nameCard: '', numCard: '', vencimiento: '', pais: 'Mexico', cp: '',
      address: '', ciudad: '', estado: ''
    }, { emitEvent: false });
    this.formulario.controls.ccv.reset('');
    this.msiDisponibles = [];
    this.ultimoBinValidado = '';
    this.validandoBin = false;
    this.mensajeBin = '';
    if (this.usaTarjetaGuardada) {
      this.cargandoDetalleTarjeta = true;
      this.detalleTarjetaSubscription = this.pagarLinkPagoService.obtenerDetalleTarjeta(this.merchantId, this.tarjetaSeleccionada).subscribe({
        next: response => {
          const datos = response?.rows ?? response?.data ?? response;
          const detalle = Array.isArray(datos) ? datos[0] : datos;
          this.detalleTarjeta = detalle;
          const instrumento = detalle?.paymentInstrument;
          const tarjeta = detalle?.paymentInformation?.card ?? detalle?.enrollmentRequest?.paymentInformation?.card ?? detalle?.card ?? {};
          const facturacion = detalle?.orderInformation?.billTo ?? detalle?.enrollmentRequest?.orderInformation?.billTo ?? detalle?.billTo ?? {};
          const nombre = instrumento?.name ?? tarjeta?.name ?? tarjeta?.cardholderName
            ?? [facturacion?.firstName, facturacion?.lastName].filter(Boolean).join(' ');
          const mes = String(tarjeta?.expirationMonth ?? '').padStart(2, '0');
          const anio = String(tarjeta?.expirationYear ?? '');
          const [mesInstrumento, anioInstrumento] = String(instrumento?.expirationDate ?? '').split('-');
          this.formulario.patchValue({
            nameCard: String(nombre || ''),
            numCard: this.formatearTarjetaGuardada(instrumento?.card ?? tarjeta?.number ?? detalle?.maskedPan
              ?? this.tarjetasGuardadas.find(item => item.token === this.tarjetaSeleccionada)?.etiqueta ?? ''),
            vencimiento: mesInstrumento && anioInstrumento ? `${mesInstrumento}/${anioInstrumento}`
              : mes !== '00' && anio ? `${mes}/${anio.slice(-2)}` : '',
            address: String(instrumento?.address ?? facturacion?.address1 ?? facturacion?.address ?? ''),
            ciudad: String(instrumento?.city ?? facturacion?.locality ?? facturacion?.city ?? ''),
            cp: String(instrumento?.postalCode ?? facturacion?.postalCode ?? ''),
            estado: String(instrumento?.locality ?? facturacion?.administrativeArea ?? facturacion?.state ?? ''),
            pais: String(instrumento?.country ?? facturacion?.country ?? 'Mexico')
          }, { emitEvent: false });
          this.actualizarValidacionCvv();
          this.cargandoDetalleTarjeta = false;
        },
        error: () => {
          this.cargandoDetalleTarjeta = false;
          this.mensajeTarjetas = 'No fue posible consultar el detalle de la tarjeta.';
        }
      });
    }
  }

  private cargarTarjetas(): void {
    const identificador = String(this.orden.customerInfo.clientIdentifier ?? '');
    if (!identificador) return;
    this.cargandoTarjetas = true;
    this.pagarLinkPagoService.obtenerCliente(identificador).subscribe({
      next: response => {
        this.merchantId = this.obtenerMerchantId(response);
        if (!this.merchantId) {
          this.cargandoTarjetas = false;
          this.mensajeTarjetas = 'No fue posible obtener el merchanID del cliente.';
          return;
        }
        this.pagarLinkPagoService.obtenerTarjetas(this.merchantId).subscribe({
          next: resultado => {
            const datos = resultado?.rows ?? resultado?.data ?? resultado;
            const lista = Array.isArray(datos) ? datos : datos?.tokens ?? datos?.cards ?? [];
            this.tarjetasGuardadas = lista.map((item: any) => ({
              token: String(item?.cardToken ?? item?.token ?? ''),
              etiqueta: this.obtenerNumeroTarjeta(item)
            })).filter((item: { token: string }) => item.token);
            this.cargandoTarjetas = false;
          },
          error: () => { this.cargandoTarjetas = false; this.mensajeTarjetas = 'No fue posible cargar las tarjetas guardadas.'; }
        });
      },
      error: () => { this.cargandoTarjetas = false; this.mensajeTarjetas = 'No fue posible consultar el cliente.'; }
    });
  }

  private obtenerNumeroTarjeta(item: any): string {
    const card = item?.card;
    if (typeof card === 'string' && card.trim()) return card.trim();

    const numero = card?.number ?? card?.maskedPan ?? item?.maskedPan ?? item?.maskedNumber
      ?? item?.paymentInformation?.card?.number ?? item?.cardNumber ?? item?.number;
    if (numero != null && String(numero).trim()) return String(numero).trim();

    const ultimosDigitos = item?.lastFour ?? item?.last4;
    return ultimosDigitos != null && String(ultimosDigitos).trim()
      ? `**** ${String(ultimosDigitos).trim()}`
      : 'Número no disponible';
  }

  private formatearTarjetaGuardada(numero: unknown): string {
    return String(numero ?? '').replace(/[\s-]/g, '').replace(/(.{4})(?=.)/g, '$1-');
  }

  private obtenerMerchantId(respuesta: any): string {
    if (Array.isArray(respuesta)) {
      for (const item of respuesta) {
        const id = this.obtenerMerchantId(item);
        if (id) return id;
      }
      return '';
    }
    if (!respuesta || typeof respuesta !== 'object') return '';

    const id = respuesta.merchanID ?? respuesta.merchantID ?? respuesta.merchantId;
    if (id != null && String(id).trim()) return String(id).trim();

    for (const llave of ['rows', 'data', 'customer', 'customerResponse', 'contextResponse']) {
      const valor = this.obtenerMerchantId(respuesta[llave]);
      if (valor) return valor;
    }
    return '';
  }

  get permitePropina(): boolean {
    const valor = this.orden?.tip;
    return valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  get permiteMsi(): boolean {
    const valor = this.orden?.msi;
    return valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  get subtotal(): number {
    return Number(this.esPagoMixto ? this.formulario.controls.amountPending.value : this.orden?.amount) || 0;
  }

  get propinaCalculada(): number {
    const porcentaje = Number(this.formulario.controls.propinaPorcentaje.value) || 0;
    const personalizada = Number(this.formulario.controls.propina.value) || 0;
    return personalizada > 0 ? personalizada : this.subtotal * porcentaje / 100;
  }

  get total(): number { return this.subtotal + this.propinaCalculada; }

  get descripcionPagoSeleccionado(): string {
    const meses = Number(this.formulario.controls.meses.value) || 1;
    return meses === 1 ? 'Un solo pago' : `${meses} meses`;
  }

  get tarjetaOculta(): string {
    if (this.usaTarjetaGuardada) return this.tarjetasGuardadas.find(item => item.token === this.tarjetaSeleccionada)?.etiqueta ?? 'Número no disponible';
    const numero = (this.formulario.controls.numCard.value || '').replace(/\s/g, '');
    return numero ? `**** **** **** ${numero.slice(-4)}` : 'ND';
  }

  get longitudCvv(): number {
    if (this.usaTarjetaGuardada) {
      const marca = String(this.detalleTarjeta?.paymentInstrument?.brand
        ?? this.detalleTarjeta?.paymentInformation?.card?.brand
        ?? this.detalleTarjeta?.card?.brand ?? this.detalleTarjeta?.brand ?? '').toLowerCase();
      return marca.includes('amex') || marca.includes('american express') ? 4 : 3;
    }
    const numeroTarjeta = String(this.formulario.controls.numCard.value || '').replace(/\D/g, '');
    return numeroTarjeta.startsWith('3') ? 4 : 3;
  }

  get clabe(): string {
    return this.orden?.speiInfo?.orderingAccount ?? this.orden?.transferInfo?.orderingAccount ?? this.orden?.orderingAccount ?? 'Pendiente de asignar';
  }

  get telefonoTransferencia(): string {
    return this.orden?.speiInfo?.phone ?? this.orden?.transferInfo?.phone ?? this.orden?.customerInfo?.phone1 ?? 'ND';
  }

  seleccionarTab(tab: 'tarjeta' | 'transferencia'): void {
    this.tabActiva = tab;
    this.mostrarResumen = false;
  }

  continuar(): void {
    if (!this.mostrarOpcionesPago) {
      if (this.usaTarjetaGuardada && !this.detalleTarjeta) {
        this.mensajeTarjetas = 'Espera a que se carguen los datos de la tarjeta.';
        return;
      }
      const camposTarjeta = this.usaTarjetaGuardada ? [this.formulario.controls.ccv] : [
        this.formulario.controls.nameCard,
        this.formulario.controls.numCard,
        this.formulario.controls.vencimiento,
        this.formulario.controls.ccv,
        this.formulario.controls.pais,
        this.formulario.controls.cp
      ];
      if (this.permiteTarjetasGuardadas && !this.usaTarjetaGuardada) {
        for (const campo of ['address', 'ciudad', 'estado'] as const) {
          const control = this.formulario.controls[campo];
          control.setValidators(Validators.required);
          control.updateValueAndValidity({ emitEvent: false });
          camposTarjeta.push(control);
        }
      }
      camposTarjeta.forEach(control => control.markAsTouched());
      if (camposTarjeta.some(control => control.invalid)) return;
      if (this.permiteMsi && !Number(this.formulario.controls.meses.value)) {
        this.formulario.controls.meses.setValue(1);
      }
      this.mostrarOpcionesPago = true;
      return;
    }

    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;
    this.mostrarResumen = true;
  }

  procesarPago(): void {
    if (this.formulario.invalid || this.enviandoPago || (this.usaTarjetaGuardada && !this.detalleTarjeta)) return;

    const vencimiento = String(this.formulario.controls.vencimiento.value || '').split('/');
    const instrumento = this.detalleTarjeta?.paymentInstrument;
    const tarjetaDetalle = this.detalleTarjeta?.paymentInformation?.card ?? this.detalleTarjeta?.card ?? {};
    const [mesInstrumento, anioInstrumento] = String(instrumento?.expirationDate ?? '').split('-');
    const expirationMonth = this.usaTarjetaGuardada
      ? String(mesInstrumento || tarjetaDetalle.expirationMonth || '') : (vencimiento[0] || '').trim();
    const expirationYear = this.usaTarjetaGuardada
      ? String(anioInstrumento || tarjetaDetalle.expirationYear || '') : (vencimiento[1] || '').trim();
    const cliente = this.orden?.customerInfo || {};
    const address = this.formulario.controls.address.value?.trim() || 'Generico';
    const ciudad = this.formulario.controls.ciudad.value?.trim() || 'Generico';
    const estado = this.formulario.controls.estado.value?.trim() || 'Generico';
    const payInfo = this.orden?.payInfo || {};
    const numeroTarjeta = String(this.usaTarjetaGuardada
      ? instrumento?.card ?? tarjetaDetalle?.number ?? this.formulario.controls.numCard.value
      : this.formulario.controls.numCard.value || '').replace(/\D/g, '');
    if (!/^\d{13,19}$/.test(numeroTarjeta)) {
      this.errorPago = 'No fue posible obtener el número completo de la tarjeta.';
      return;
    }

    const payload = {
      messagetype: 90,
      posEntryMode: 6,
      amount: this.subtotal,
      otherAmount: this.propinaCalculada,
      user: this.orden?.user ?? cliente.email ?? '',
      currency: '484',
      reference_payment: this.orden?.id || '',
      sirioId: this.orden?.sirioID ?? this.orden?.sirioId ?? '',
      orderingAccount: this.orden?.orderingAccount || '',
      payment_type: 1,
      paymentMethod: Number(this.orden?.paymentMethod?.paymentMethodID) || 3,
      typeCorrespondient: this.orden?.typeCorrespondient || 'Tarjeta de credito o debito',
      retrievalReferenceCode: this.orden?.retrievalReferenceCode ?? payInfo.reference ?? '',
      payPhone: this.orden?.payPhone ?? cliente.phone1 ?? '',
      payEmail: this.orden?.payEmail ?? cliente.email ?? '',
      referenceOne: this.orden?.referenceOne || '',
      referenceTwo: this.orden?.referenceTwo || '',
      referenceThree: '',
      customerInfo: {
        firstName: cliente.firstName || '',
        lastName: cliente.lastName || '',
        middleName: '',
        email: cliente.email || '',
        phone1: cliente.phone1 || '',
        city: ciudad,
        address1: address,
        postalCode: this.formulario.controls.cp.value || '',
        state: estado,
        country: this.formulario.controls.pais.value || '',
        ip: this.ip || cliente.ip || this.orden?.ip || ''
      },
      cardData: {
        cardNumber: numeroTarjeta,
        cvv: this.formulario.controls.ccv.value || '',
        cardholderName: this.formulario.controls.nameCard.value || '',
        expirationYear,
        expirationMonth
      },
      itInformation: {
        so: 'Android||Edge||IOS||Chrome',
        fab: 'Xiaomi',
        model: 'MI 8 Lite||VersionNavegador',
        latitude: this.latitud,
        longitude: this.longitud
      },
      promotion: {
        qtyPay: Number(this.formulario.controls.meses.value) || 1,
        planID: 0,
        graceNumbers: 0
      }
    };

    this.enviandoPago = true;
    this.mensajePago = '';
    this.errorPago = '';
    this.pagarLinkPagoService.procesarTransaccion(payload).subscribe({
      next: response => {
        this.enviandoPago = false;
        if (response?.success !== true) {
          this.errorPago = response?.error?.message || response?.message || response?.mensaje || 'No fue posible procesar el pago.';
          return;
        }
        this.mensajePago = response?.message || response?.mensaje || 'Pago procesado correctamente.';
        const registrar = this.orden?.customerInfo?.registerClient;
        if (this.permiteTarjetasGuardadas && !this.usaTarjetaGuardada
          && (registrar === true || registrar === 1 || registrar === '1' || registrar === 'true')) {
          this.pagarLinkPagoService.agregarTarjeta({
            firstName: cliente.firstName || '', lastName: cliente.lastName || '', email: cliente.email || '',
            postalCode: this.formulario.controls.cp.value || '',
            address,
            locality: estado,
            country: this.formulario.controls.pais.value || '', number: numeroTarjeta,
            expirationMonth, expirationYear,
            merchantCustomerID: this.merchantId || String(cliente.clientIdentifier)
          }).subscribe({
            error: () => { this.mensajeTarjetas = 'El pago se procesó, pero no se pudo guardar la tarjeta.'; }
          });
        }
        this.abrirVoucher();
      },
      error: error => {
        this.enviandoPago = false;
        this.errorPago = error?.error?.message || error?.error?.mensaje || 'No fue posible procesar el pago.';
      }
    });
  }

  cerrarErrorPago(): void {
    this.errorPago = '';
  }

  private abrirVoucher(): void {
    void this.router.navigate(['/voucher'], {
      queryParams: { reference: this.orden?.id || this.referencia },
      replaceUrl: true
    });
  }

  volverAlFormulario(): void { this.mostrarResumen = false; }
  seleccionarPropina(porcentaje: number): void {
    this.formulario.controls.propina.setValue(0, { emitEvent: false });
    this.formulario.controls.propina.disable({ emitEvent: false });
    this.formulario.controls.propinaPorcentaje.setValue(porcentaje);
  }

  seleccionarOtraPropina(): void {
    this.formulario.controls.propinaPorcentaje.setValue(0);
    this.formulario.controls.propina.setValue(0, { emitEvent: false });
    this.formulario.controls.propina.enable({ emitEvent: false });
  }

  get propinaPersonalizadaActiva(): boolean {
    return this.formulario.controls.propina.enabled;
  }

  formatearNumeroTarjeta(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '').slice(0, 16);
    const numeroFormateado = digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.formulario.controls.numCard.setValue(numeroFormateado, { emitEvent: false });
    this.actualizarValidacionCvv();
    this.validarBinActual();
  }

  formatearCvv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cvv = input.value.replace(/\D/g, '').slice(0, this.longitudCvv);
    this.formulario.controls.ccv.setValue(cvv, { emitEvent: false });
  }

  formatearVencimiento(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digitos = input.value.replace(/\D/g, '').slice(0, 4);

    if (digitos.length >= 2 && Number(digitos.slice(0, 2)) > 12) {
      digitos = digitos.slice(0, 1);
    }

    const vencimiento = digitos.length > 2
      ? `${digitos.slice(0, 2)}/${digitos.slice(2)}`
      : digitos;
    this.formulario.controls.vencimiento.setValue(vencimiento, { emitEvent: false });
    this.formulario.controls.vencimiento.updateValueAndValidity({ emitEvent: false });
  }

  formatearCodigoPostal(event: Event): void {
    const input = event.target as HTMLInputElement;
    const codigoPostal = input.value.replace(/\D/g, '').slice(0, 5);
    this.formulario.controls.cp.setValue(codigoPostal, { emitEvent: false });
  }

  formatearTextoSinEspeciales(event: Event, campo: 'nameCard' | 'pais'): void {
    const input = event.target as HTMLInputElement;
    const texto = input.value.replace(/[^A-Za-z ]/g, '').replace(/\s{2,}/g, ' ');
    this.formulario.controls[campo].setValue(texto, { emitEvent: false });
    this.formulario.controls[campo].updateValueAndValidity({ emitEvent: false });
  }

  get mensajeErrorVencimiento(): string {
    const errores = this.formulario.controls.vencimiento.errors;
    if (errores?.['mes']) return 'El mes debe estar entre 01 y 12.';
    if (errores?.['vencida']) return 'La tarjeta esta vencida.';
    if (errores?.['limite']) return 'El vencimiento no puede superar 10 anos.';
    return 'Capture una fecha valida en formato MM/AA.';
  }

  private actualizarValidacionCvv(): void {
    const longitud = this.longitudCvv;
    const control = this.formulario.controls.ccv;
    const valor = String(control.value || '').replace(/\D/g, '').slice(0, longitud);
    control.setValidators([
      Validators.required,
      Validators.pattern(longitud === 4 ? /^\d{4}$/ : /^\d{3}$/)
    ]);
    control.setValue(valor, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  revalidarBin(): void {
    this.ultimoBinValidado = '';
    this.validarBinActual();
  }

  private validarBinActual(): void {
    const digitos = (this.formulario.controls.numCard.value || '').replace(/\D/g, '');
    if (digitos.length < 4) {
      this.validacionBinSubscription?.unsubscribe();
      this.ultimoBinValidado = '';
      this.validandoBin = false;
      this.msiDisponibles = [];
      this.mensajeBin = '';
      return;
    }

    const bin = digitos.slice(0, 4);
    if (bin === this.ultimoBinValidado) return;

    this.validacionBinSubscription?.unsubscribe();
    this.ultimoBinValidado = bin;
    this.validandoBin = true;
    this.mensajeBin = '';
    this.msiDisponibles = [];
    this.formulario.controls.meses.setValue(0);

    this.validacionBinSubscription = this.pagarLinkPagoService.validarBin(bin, this.subtotal).subscribe({
      next: response => {
        const catalogo = response?.rows?.msi
          ?? response?.rows
          ?? response?.data?.msi
          ?? response?.data
          ?? response?.msi
          ?? response;
        const elementos = Array.isArray(catalogo) ? catalogo : [];

        this.msiDisponibles = elementos
          .map((item: any) => {
            const meses = Number(typeof item === 'number'
              ? item
              : item?.months ?? item?.month ?? item?.installments ?? item?.numberPayments ?? item?.id ?? item?.value);
            return {
              meses,
              descripcion: typeof item === 'object'
                ? String(item?.description ?? item?.name ?? item?.label ?? `${meses} meses`)
                : `${meses} meses`
            };
          })
          .filter((item: { meses: number }) => Number.isFinite(item.meses) && item.meses > 1);

        this.validandoBin = false;
        this.mensajeBin = this.msiDisponibles.length
          ? ''
          : 'La tarjeta no tiene promociones de meses sin intereses disponibles.';
      },
      error: error => {
        this.validandoBin = false;
        this.ultimoBinValidado = '';
        this.mensajeBin = error?.error?.message
          || error?.error?.mensaje
          || 'No fue posible validar la tarjeta.';
      }
    });
  }

  async copiar(valor: unknown): Promise<void> {
    const texto = String(valor ?? '').trim();
    if (!texto) return;
    await navigator.clipboard.writeText(texto);
    this.mensajeCopiado = 'Dato copiado';
    window.setTimeout(() => this.mensajeCopiado = '', 1800);
  }

  compartirTransferencia(tipo: 'correo' | 'whatsapp'): void {
    const texto = `Datos para transferencia. CLABE: ${this.clabe}, referencia: ${this.orden?.payInfo?.reference || ''}`;
    if (tipo === 'correo') {
      window.location.href = `mailto:?subject=${encodeURIComponent('Datos para transferencia')}&body=${encodeURIComponent(texto)}`;
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  }

}

function validarVencimientoTarjeta(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value || '').trim();
  const coincidencia = /^(\d{2})\/(\d{2})$/.exec(valor);
  if (!coincidencia) return { formato: true };

  const mes = Number(coincidencia[1]);
  if (mes < 1 || mes > 12) return { mes: true };

  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;
  const sigloActual = Math.floor(anioActual / 100) * 100;
  const anio = sigloActual + Number(coincidencia[2]);

  if (anio < anioActual || (anio === anioActual && mes < mesActual)) return { vencida: true };
  if (anio > anioActual + 10) return { limite: true };
  return null;
}
