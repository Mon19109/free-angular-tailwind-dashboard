import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

//import { AuthService, UserSessionData } from '../../services/auth.service';
import { OrdenPagoService } from '../../services/OrdenPago.service';
import { RadioComponent } from '../../shared/components/form/input/radio.component';
import { FormsModule } from '@angular/forms';

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
    payloadPendiente: any = null;

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

        const idUser = this.sesion?.idUser || localStorage.getItem('idUser');

        if (!idUser) {
            console.warn('No hay idUser para cargar beneficiarios');
            return;
        }

        console.log('Cargando beneficiarios con idUser:', idUser);

        this.ordenPagoService
            .obtenerContactos(Number(idUser))
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

            tarjeta: beneficiario?.cardNumber

            //mail: this.sesion?.mail

        };

        this.payloadPendiente = payload;

       /* this.ordenPagoService
            .enviarToken(
                this.sesion!.idUser
            )
            .subscribe({
                next: (resp) => {

                    console.log('TOKEN SMS ENVIADO', resp);

                    this.mostrarModalToken = true;

                },
                error: (err) => {

                    console.error('ERROR SMS', err);

                    this.mostrarModalToken = true;

                }
            });*/

            // TEMPORALMENTE SIN TOKEN
this.ordenPagoService
    .realizarSpei(payload)
    .subscribe({
        next: (resp) => {

            console.log(
                'SPEI ENVIADO',
                resp
            );

        },
        error: (err) => {

            console.error(
                'ERROR SPEI',
                err
            );

        }
     });

    }

    validarToken(): void {

       /*this.ordenPagoService.validarToken(
         this.token,
         this.sesion!.idUser
        )
            .subscribe({
                next: (resp) => {

                    console.log(
                        'VALIDACION TOKEN',
                        resp
                    );

                    this.mostrarModalToken = false;

                    this.ordenPagoService
                        .realizarSpei(
                            this.payloadPendiente
                        )
                        .subscribe({
                            next: (r) => {

                                console.log(
                                    'SPEI ENVIADO',
                                    r
                                );

                            },
                            error: (e) => {

                                console.error(
                                    e
                                );

                            }
                        });

                },
                error: (err) => {

                    console.error(
                        'TOKEN INVALIDO',
                        err
                    );

                }
            });*/

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

}
