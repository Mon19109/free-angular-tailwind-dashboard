import { CommonModule } from '@angular/common';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfiliacionesService, AfiliacionesResponse, Afiliacion } from '../../services/afiliaciones.service';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { ModalComponent } from '../../shared/components/ui/modal/modal.component';

@Component({
  selector: 'app-registro-afiliacion',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessingOverlayComponent, ModalComponent],
  templateUrl: './registroAfiliacion.component.html',
  styleUrls: ['./registroAfiliacion.component.css']
})
export class RegistroAfiliacionComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  referenciaComercio = '';
  nombreComercio = '';
  afiliacionProsa = '';
  giroProsa = '';
  afiliacionAmex = '';
  giroAmex = '';
  procesando = false;
  textoCarga = '';
  aviso = '';
  verificado = false;
  bloqueado = true;
  resultado: { exito: boolean; titulo: string; mensaje: string } | null = null;
  private registros: Afiliacion[] = [];
  private revision = '';

  constructor(private route: ActivatedRoute, private afiliaciones: AfiliacionesService) {}

  ngOnInit(): void {
    this.referenciaComercio = this.route.snapshot.queryParamMap.get('ref') ?? '';
    this.consultar();
  }

  get puedeGuardar(): boolean {
    return !this.procesando && this.verificado && !this.bloqueado && !this.resultado &&
      [this.afiliacionProsa, this.giroProsa, this.afiliacionAmex, this.giroAmex].every(value => !!value.trim() && value.length <= 128);
  }

  consultar(): void {
    if (this.procesando) return;
    if (!this.referenciaComercio) {
      this.error('Falta la referencia del comercio. Vuelve a seleccionarlo en el Dashboard.');
      return;
    }
    this.procesando = true;
    this.resultado = null;
    this.textoCarga = 'Consultando afiliaciones...';
    this.afiliaciones.consultar(this.referenciaComercio).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.procesando = false)
    ).subscribe({ next: response => this.aplicar(response), error: error => this.error(this.mensajeError(error)) });
  }

  guardar(): void {
    if (!this.puedeGuardar) return;
    const method = this.registros.length === 0 ? 'POST' : 'PUT';
    const payload: Afiliacion[] = [
      { processor: 'AMEX', number: this.afiliacionAmex, businessLine: this.giroAmex },
      { processor: 'PROSA', number: this.afiliacionProsa, businessLine: this.giroProsa }
    ].map(row => method === 'PUT' ? { ...row, id: this.registros.find(item => item.processor === row.processor)?.id } : row) as Afiliacion[];
    this.procesando = true;
    this.resultado = null;
    this.textoCarga = method === 'POST' ? 'Guardando afiliaciones...' : 'Actualizando afiliaciones...';
    this.afiliaciones.guardar(this.referenciaComercio, method, payload, this.revision).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.procesando = false)
    ).subscribe({
      next: response => {
        this.aplicar(response);
        if (response.writeBlocked) {
          this.error(response.message || 'No fue posible verificar el guardado. Consulta nuevamente.');
          return;
        }
        this.resultado = { exito: true, titulo: method === 'POST' ? 'Registro exitoso' : 'Actualización exitosa',
          mensaje: method === 'POST' ? 'Las afiliaciones se guardaron correctamente' : 'Las afiliaciones se actualizaron correctamente' };
      },
      error: error => this.error(this.mensajeError(error))
    });
  }

  private aplicar(response: AfiliacionesResponse): void {
    this.nombreComercio = response.name;
    this.registros = response.affiliations;
    this.revision = response.revision;
    const prosa = this.registros.find(row => row.processor === 'PROSA');
    const amex = this.registros.find(row => row.processor === 'AMEX');
    this.afiliacionProsa = prosa?.number ?? '';
    this.giroProsa = prosa?.businessLine ?? '';
    this.afiliacionAmex = amex?.number ?? '';
    this.giroAmex = amex?.businessLine ?? '';
    this.verificado = true;
    this.bloqueado = response.writeBlocked || this.registros.length === 1;
    this.aviso = response.message;
  }

  private error(mensaje: string): void {
    this.verificado = false;
    this.bloqueado = true;
    this.aviso = 'Consulta las afiliaciones para verificar su estado antes de guardar.';
    this.resultado = { exito: false, titulo: 'No fue posible completar la operación', mensaje };
  }
  private mensajeError(error: any): string {
    return typeof error?.error?.message === 'string' ? error.error.message :
      'No fue posible verificar las afiliaciones. Consulta nuevamente antes de guardar.';
  }
}
