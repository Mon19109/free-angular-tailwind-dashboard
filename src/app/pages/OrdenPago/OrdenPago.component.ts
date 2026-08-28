import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

//import { AuthService, UserSessionData } from '../../services/auth.service';
import { OrdenPagoService } from '../../services/OrdenPago.service';
import { RadioComponent } from '../../shared/components/form/input/radio.component';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-orden-pago',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule, RadioComponent, FormsModule

    ],
    templateUrl: './OrdenPago.component.html',
    styleUrls: ['./OrdenPago.component.css']
})
export class OrdenPagoComponent implements OnInit {

    formulario!: FormGroup;

    pasoActual = 1;
    saldo = 0;
    tipoEnvio = 'INDIVIDUAL';
    mostrarErrorImporte = false;

    mostrarModalToken = false;
    token = '';
    tokenError = '';
    tokenMensaje = '';
    payloadPendiente: any = null;
    finalizandoEnvio = false;
    validandoToken = false;
    reenviandoToken = false;
    comprobanteSpei: any = null;
    mensajeEnvio = '';
    tipoMensajeEnvio: 'success' | 'error' = 'success';

    cuentas: any[] = [];
    beneficiarios: any[] = [];
    beneficiariosCargados = false;

    //sesion: UserSessionData | null = null;
    private sesion: any = null;

    constructor(
        private fb: FormBuilder,
        //private authService: AuthService,
        private ordenPagoService: OrdenPagoService
    ) { }

    ngOnInit(): void {

        this.sesion = this.obtenerSesion();

        this.formulario = this.fb.group({
            cuentaOr: [''],
            cuentaD: [''],
            importe: [''],
            concepto: [''],
            referencia: ['']
        });

        this.cargarCuentas();
        this.cargarBeneficiarios();

        /*console.log('SESION');
        console.log(this.sesion);

        console.log('ID USER');
        console.log(this.sesion?.idUser);



        this.formulario = this.fb.group({
            //por si se requiere mandar
            //tipoEnvio: ['INDIVIDUAL'],
            cuentaOr: [''],
            cuentaD: [''],
            importe: [''],
            concepto: [''],
            referencia: ['']
        });

        this.cargarCuentas();
        this.cargarBeneficiarios();*/

    }

    cambiarTipoEnvio(valor: string): void {

        this.tipoEnvio = valor;
        this.limpiarMensajeEnvio();
        /*
         this.formulario.patchValue({
          tipoEnvio: valor
        });
      */

        console.log('Tipo envío:', valor);

    }

    cargarCuentas(): void {

        const entitySonID = this.sesion?.entitySonID || localStorage.getItem('entitySonID');

        if (!entitySonID) {
            console.warn('No hay entitySonID para cargar cuentas ordenantes');
            return;
        }

        this.ordenPagoService
            .obtenerCuentas(entitySonID)
            .subscribe({
                next: (resp) => {

                    console.log('Cuentas ordenantes', resp);

                    this.cuentas = this.normalizarLista(resp, [
                        'data',
                        'accounts',
                        'concentratorAccounts',
                        'accountList'
                    ]);

                },
                error: (err) => {
                    console.error('Error al cargar cuentas ordenantes', err);
                }
            });
    }

    cargarBeneficiarios(): void {

        const idUser =
            this.sesion?.validate ||
            localStorage.getItem('validate') ||
            this.sesion?.idUser ||
            localStorage.getItem('idUser');

        if (!idUser) {
            console.warn('No hay idUser para cargar beneficiarios');
            return;
        }

        console.log('Cargando beneficiarios con idUser:', idUser);

        this.ordenPagoService
            .obtenerContactos(String(idUser))
            .subscribe({
                next: (resp) => {

                    console.log('Beneficiarios', resp);
                    this.beneficiariosCargados = true;
                    this.beneficiarios = this.normalizarLista(resp, [
                        'data',
                        'contacts',
                        'contactList',
                        'contactResponse',
                        'contactsResponse',
                        'beneficiaries',
                        'beneficiarios'
                    ]);

                },
                error: (err) => {
                    this.beneficiariosCargados = true;
                    console.error('Error al cargar beneficiarios', err);
                }
            });

    }

    private obtenerSesion(): any {
        const rawSession = localStorage.getItem('auth_session');

        if (rawSession) {
            try {
                return JSON.parse(rawSession);
            } catch {
                return null;
            }
        }

        return null;
    }

    private normalizarLista(response: any, keys: string[]): any[] {
        if (Array.isArray(response)) {
            return response;
        }

        for (const key of keys) {
            if (Array.isArray(response?.[key])) {
                return response[key];
            }
        }

        return this.encontrarPrimerArreglo(response);
    }

    private encontrarPrimerArreglo(value: any): any[] {
        if (!value || typeof value !== 'object') {
            return [];
        }

        for (const item of Object.values(value)) {
            if (Array.isArray(item)) {
                return item;
            }

            const nested = this.encontrarPrimerArreglo(item);
            if (nested.length) {
                return nested;
            }
        }

        return [];
    }

    obtenerValorCuenta(cuenta: any): string {
        return cuenta?.idSirio || cuenta?.bundle || cuenta?.sirioId || cuenta?.id || '';
    }

    obtenerTextoCuenta(cuenta: any): string {
        const id = this.obtenerValorCuenta(cuenta);
        const nombre = cuenta?.name || cuenta?.bussinesName || cuenta?.businessName || cuenta?.alias || '';

        return [id, nombre].filter(Boolean).join(' - ');
    }

    obtenerValorBeneficiario(beneficiario: any): string {
        return beneficiario?.idContact || beneficiario?.id || beneficiario?.contactId || '';
    }

    obtenerTextoBeneficiario(beneficiario: any): string {
        const alias = beneficiario?.nameAlias || beneficiario?.alias || beneficiario?.fullName || beneficiario?.name || '';
        const cuenta = beneficiario?.cardNumberMask || beneficiario?.accountNumberMask || beneficiario?.accountNumber || beneficiario?.cardNumber || '';
        const banco = beneficiario?.nameInstitution || beneficiario?.institutionName || beneficiario?.bankName || '';
        const terminacion = cuenta ? ` **** ${String(cuenta).slice(-4)}` : '';

        return `${alias}${terminacion} ${banco}`.trim();
    }

    obtenerSaldo(): void {

        const cuentaSeleccionada =
            this.formulario.get('cuentaOr')?.value;

        if (!cuentaSeleccionada) {
            return;
        }

        /*console.log(
            'Cuenta seleccionada:',
            cuentaSeleccionada
        );*/

        this.ordenPagoService
            .obtenerSaldo(cuentaSeleccionada)
            .subscribe({
                next: (resp) => {

                    // console.log('SALDO RESP', resp);

                    this.saldo =
                        resp?.balance ??
                        0;

                },
                error: (err) => {

                    console.error(
                        'ERROR SALDO',
                        err
                    );

                }
            });

    }


    siguiente(): void {
        this.limpiarMensajeEnvio();

        if (this.pasoActual === 2) {

            const importe =
                this.formulario.get('importe')?.value;

            if (!importe || Number(importe) <= 0) {

                this.mostrarErrorImporte = true;

                return;
            }

            this.mostrarErrorImporte = false;
        }

        this.pasoActual++;

    }

    atras(): void {
        this.pasoActual--;
    }

    finalizar(): void {
        if (this.finalizandoEnvio) {
            return;
        }

        const beneficiario = this.beneficiarios.find(
            x => this.obtenerValorBeneficiario(x) == this.formulario.value.cuentaD
        );

        const payload = {

            ...this.formulario.value,

            masivaT: 0,

            fecha: new Date(),

            titular: beneficiario?.fullName,

            nameIns: beneficiario?.nameInstitution,

            saldoS: this.saldo,

            idIns: beneficiario?.idInstitution,

            accountNumber: beneficiario?.accountNumber,

            cuenta: beneficiario?.cardNumber || beneficiario?.accountNumber,

            cuentaMascara: beneficiario?.cardNumberMask || beneficiario?.accountNumberMask,

            tarjeta: beneficiario?.cardNumber,

            tipoCuenta: beneficiario?.accountType || beneficiario?.typeAccount || 'Tarjeta',

            tipoBeneficiario: beneficiario?.beneficiaryType || beneficiario?.typeBeneficiary || 'Persona física',

            mail: this.sesion?.mail || localStorage.getItem('mail') || ''

            //mail: this.sesion?.mail

        };

        this.payloadPendiente = payload;

        this.limpiarMensajeEnvio();
        this.solicitarToken(false);

    }

    validarToken(): void {

        const codigo = this.token.trim();
        const guid = this.obtenerGuid();

        if (!codigo) {
            this.tokenError = 'Captura el token recibido por SMS.';
            return;
        }

        if (!guid || !this.payloadPendiente || this.validandoToken) {
            this.tokenError = !guid
                ? 'No se encontró el identificador de la sesión.'
                : 'No hay una orden pendiente por validar.';
            return;
        }

        this.validandoToken = true;
        this.tokenError = '';
        this.tokenMensaje = '';

        this.ordenPagoService.validarToken(codigo, guid).pipe(
            finalize(() => this.validandoToken = false)
        ).subscribe({
            next: resp => {
                if (!this.esRespuestaExitosa(resp)) {
                    this.tokenError = this.obtenerMensajeRespuesta(resp, 'El token capturado no es válido.');
                    return;
                }

                this.mostrarModalToken = false;
                this.ejecutarSpei();
            },
            error: err => {
                console.error('Error al validar el token:', err);
                this.tokenError = this.obtenerMensajeRespuesta(err?.error, 'No fue posible validar el token.');
            }
        });

    }

    formatearImporte(event: any): void {

        this.mostrarErrorImporte = false;

        let valor = event.target.value;

        valor = valor.replace(/\D/g, '');

        if (!valor) {

            this.formulario.patchValue(
                { importe: '' },
                { emitEvent: false }
            );

            return;
        }

        const numero = Number(valor) / 100;

        const formateado = numero.toFixed(2);

        this.formulario.patchValue(
            { importe: formateado },
            { emitEvent: false }
        );

    }

    obtenerNombreBeneficiario(): string {

        const beneficiario = this.beneficiarios.find(
            x => this.obtenerValorBeneficiario(x) == this.formulario.value.cuentaD
        );

        return beneficiario?.fullName || '';

    }

    obtenerBancoBeneficiario(): string {

        const beneficiario = this.beneficiarios.find(
            x => this.obtenerValorBeneficiario(x) == this.formulario.value.cuentaD
        );

        return beneficiario?.nameInstitution || '';

    }

    obtenerCuentaBeneficiario(): string {

        const beneficiario = this.beneficiarios.find(
            x => this.obtenerValorBeneficiario(x) == this.formulario.value.cuentaD
        );

        return beneficiario?.cardNumberMask || '';

    }

    reenviarToken(): void {
        this.solicitarToken(true);
    }

    cerrarModalToken(): void {
        if (this.validandoToken || this.reenviandoToken) return;
        this.mostrarModalToken = false;
        this.token = '';
        this.tokenError = '';
        this.tokenMensaje = '';
    }

    limpiarErrorToken(): void {
        this.tokenError = '';
    }

    cerrarComprobante(): void {
        this.comprobanteSpei = null;
    }

    obtenerTelefonoSesion(): string {
        const telefono = String(
            this.sesion?.tel || this.sesion?.telefono || this.sesion?.phone ||
            localStorage.getItem('tel') || localStorage.getItem('telefono') || ''
        );

        return telefono ? `terminación ${telefono.slice(-4)}` : 'registrado';
    }

    private solicitarToken(esReenvio: boolean): void {
        const guid = this.obtenerGuid();

        if (!guid) {
            this.tipoMensajeEnvio = 'error';
            this.mensajeEnvio = 'No se encontró el identificador de la sesión para enviar el token.';
            return;
        }

        if (esReenvio && this.reenviandoToken) return;
        if (!esReenvio && this.finalizandoEnvio) return;

        if (esReenvio) {
            this.reenviandoToken = true;
        } else {
            this.finalizandoEnvio = true;
        }

        this.tokenError = '';
        this.tokenMensaje = '';

        this.ordenPagoService.enviarToken(guid).pipe(
            finalize(() => {
                this.finalizandoEnvio = false;
                this.reenviandoToken = false;
            })
        ).subscribe({
            next: resp => {
                if (this.respuestaEsFallo(resp)) {
                    const mensaje = this.obtenerMensajeRespuesta(resp, 'No fue posible enviar el token por SMS.');
                    if (esReenvio) this.tokenError = mensaje;
                    else {
                        this.tipoMensajeEnvio = 'error';
                        this.mensajeEnvio = mensaje;
                    }
                    return;
                }

                this.mostrarModalToken = true;
                this.token = '';
                this.tokenMensaje = esReenvio
                    ? 'Se envió un nuevo token por SMS.'
                    : 'Token enviado por SMS correctamente.';
            },
            error: err => {
                console.error('Error al enviar el token:', err);
                const mensaje = this.obtenerMensajeRespuesta(err?.error, 'No fue posible enviar el token por SMS.');
                if (esReenvio) this.tokenError = mensaje;
                else {
                    this.tipoMensajeEnvio = 'error';
                    this.mensajeEnvio = mensaje;
                }
            }
        });
    }

    private ejecutarSpei(): void {
        const payload = this.payloadPendiente;
        if (!payload) return;

        this.finalizandoEnvio = true;
        this.limpiarMensajeEnvio();

        this.ordenPagoService.realizarSpei(payload).pipe(
            finalize(() => this.finalizandoEnvio = false)
        ).subscribe({
            next: resp => {
                if (!this.esSpeiExitoso(resp)) {
                    this.tipoMensajeEnvio = 'error';
                    this.mensajeEnvio = this.obtenerMensajeRespuesta(
                        resp,
                        'El servicio SPEI no confirmó la operación con código 00.'
                    );
                    return;
                }

                this.comprobanteSpei = this.crearComprobante(resp, payload);
                this.tipoMensajeEnvio = 'success';
                this.mensajeEnvio = 'Envío realizado correctamente.';
                this.reiniciarFlujo();
            },
            error: err => {
                console.error('Error al liberar el SPEI:', err);
                this.tipoMensajeEnvio = 'error';
                this.mensajeEnvio = this.obtenerMensajeRespuesta(
                    err?.error,
                    'No fue posible realizar el envío. Intenta nuevamente.'
                );
            }
        });
    }

    private crearComprobante(resp: any, payload: any): any {
        const rows = Array.isArray(resp?.rows) ? resp.rows[0] : resp?.rows;
        const datos = rows || resp?.data?.rows || resp?.data || resp || {};
        const fechaOperacion = datos?.date || datos?.createdAt || new Date();
        const fecha = new Date(fechaOperacion);

        return {
            autorizacion: datos?.id || datos?.authorization || datos?.authorizationNumber || 'ND',
            fecha: Number.isNaN(fecha.getTime()) ? String(fechaOperacion) : fecha.toLocaleDateString('es-MX'),
            hora: Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-MX'),
            cuentaRetiro: this.enmascararCuenta(payload.cuentaOr),
            cuentaBeneficiaria: payload.cuentaMascara || this.enmascararCuenta(payload.accountNumber || payload.cuenta),
            banco: payload.nameIns || 'ND',
            monto: Number(payload.importe || 0),
            claveRastreo: datos?.internalReference || datos?.trackingKey || datos?.claveRastreo || 'NA',
            tipoCuenta: payload.tipoCuenta || 'Tarjeta',
            tipoBeneficiario: payload.tipoBeneficiario || 'Persona física',
            referenciaNumerica: datos?.numericReference || payload.referencia || 'NA',
            concepto: datos?.description || payload.concepto || 'NA'
        };
    }

    private obtenerGuid(): string {
        return String(this.sesion?.validate || localStorage.getItem('validate') || '');
    }

    private esRespuestaExitosa(resp: any): boolean {
        const success = resp?.success ?? resp?.data?.success ?? resp?.response?.success ?? resp?.rows?.success;
        if (success !== undefined && success !== null) {
            return success === true || success === 1 || String(success).toLowerCase() === 'true';
        }

        const codigo = resp?.code ?? resp?.error?.code ?? resp?.data?.code ?? resp?.data?.error?.code ??
            resp?.responseCode ?? resp?.rows?.code ?? resp?.rows?.error?.code;
        return codigo !== undefined && String(codigo).padStart(2, '0') === '00';
    }

    private respuestaEsFallo(resp: any): boolean {
        const success = resp?.success ?? resp?.data?.success ?? resp?.response?.success ?? resp?.rows?.success;
        return success === false || success === 0 || String(success).toLowerCase() === 'false';
    }

    private esSpeiExitoso(resp: any): boolean {
        const rows = Array.isArray(resp?.rows) ? resp.rows[0] : resp?.rows;
        const codigo = resp?.code ?? resp?.error?.code ?? resp?.responseCode ?? rows?.code ??
            rows?.error?.code ?? rows?.responseCode ?? resp?.data?.code ?? resp?.data?.error?.code ??
            resp?.data?.responseCode ?? resp?.data?.rows?.code;

        return codigo !== undefined && String(codigo).padStart(2, '0') === '00';
    }

    private obtenerMensajeRespuesta(resp: any, respaldo: string): string {
        return resp?.message || resp?.error?.message || resp?.data?.message ||
            resp?.rows?.message || resp?.description || respaldo;
    }

    private enmascararCuenta(cuenta: unknown): string {
        const valor = String(cuenta || '');
        if (!valor) return 'ND';
        if (valor.includes('*')) return valor;
        return `**** **** ${valor.slice(-4)}`;
    }

    private reiniciarFlujo(): void {
        this.pasoActual = 1;
        this.saldo = 0;
        this.mostrarErrorImporte = false;
        this.payloadPendiente = null;
        this.token = '';
        this.mostrarModalToken = false;
        this.formulario.reset({
            cuentaOr: '',
            cuentaD: '',
            importe: '',
            concepto: '',
            referencia: ''
        });
    }

    private limpiarMensajeEnvio(): void {
        this.mensajeEnvio = '';
    }

}
