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

    //sesion: UserSessionData | null = null;

    constructor(
        private fb: FormBuilder,
        //private authService: AuthService,
        private ordenPagoService: OrdenPagoService
    ) { }

    ngOnInit(): void {

        //this.sesion = this.authService.getUser();

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

       /* if (!this.sesion) {
            return;
        }

        this.ordenPagoService
            .obtenerCuentas(this.sesion.entitySonID)
            .subscribe({
                next: (resp) => {

                    // console.log('Cuentas', resp);

                    this.cuentas = resp;

                },
                error: (err) => {
                    console.error(err);
                }
            });*/
    }

    cargarBeneficiarios(): void {

        /*if (!this.sesion) {
            return;
        }

        this.ordenPagoService
            .obtenerContactos(this.sesion.idUser)
            .subscribe({
                next: (resp) => {

                    //  console.log('Beneficiarios', resp);
                    /* console.log(
                         'Primer beneficiario',
                         this.beneficiarios[0]
                     );*/
                    /*this.beneficiarios = resp ?? [];

                },
                error: (err) => {
                    console.error(err);
                }
            });*/

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
            x => x.idContact == this.formulario.value.cuentaD
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
            x => x.idContact == this.formulario.value.cuentaD
        );

        return beneficiario?.fullName || '';

    }

    obtenerBancoBeneficiario(): string {

        const beneficiario = this.beneficiarios.find(
            x => x.idContact == this.formulario.value.cuentaD
        );

        return beneficiario?.nameInstitution || '';

    }

    obtenerCuentaBeneficiario(): string {

        const beneficiario = this.beneficiarios.find(
            x => x.idContact == this.formulario.value.cuentaD
        );

        return beneficiario?.cardNumberMask || '';

    }

}