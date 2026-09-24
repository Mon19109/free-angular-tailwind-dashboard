import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AclaracionesService } from '../../services/aclaraciones.servises';

@Component({
  selector: 'app-aclaraciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './aclaraciones.componet.html',
  styleUrls: ['./aclaraciones.component.css']
})
export class AclaracionesComponent implements OnInit {
  private readonly service = inject(AclaracionesService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    tipo: ['', Validators.required],
    monto: [{ value: '', disabled: true }, Validators.required],
    motivo: ['', Validators.required],
    fechaReporte: [''],
    observaciones: [''],
    tyc1: [false, Validators.requiredTrue],
    tyc2: [false, Validators.requiredTrue]
  });

  transaccion: any = null;
  motivos: Array<{ idCatClarification: number; description: string }> = [];
  evidencias: File[] = [];
  camposEvidencia = [0, 1];
  readonly etapas = ['CREADA', 'ESPERANDO_DOCUMENTACIÓN', 'DOCUMENTACIÓN_ANEXADA', 'EN_ESPERA_DE_FALLO', 'ATENDIDO'];
  cargando = false;
  guardando = false;
  mostrarContrasena = false;
  contrasena = '';
  mensaje = '';
  error = '';
  enviado = false;
  guardada = false;

  get esAdmin(): boolean { return Number(localStorage.getItem('idRol')) === 2; }
  get cargo(): any { return this.transaccion?.chargeback; }
  get montoOriginal(): number { return Number(this.transaccion?.amount) || 0; }
  get puedeAgregarEvidencia(): boolean {
    return ['CREADA', 'ESPERANDO_DOCUMENTACIÓN'].includes(String(this.cargo?.statusDescription ?? ''));
  }
  get tipo(): 'D' | 'DP' | 'CC' | '' { return this.form.controls.tipo.value as 'D' | 'DP' | 'CC' | ''; }
  get indiceEtapa(): number { return this.etapas.indexOf(String(this.cargo?.statusDescription ?? '')); }

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('validate');
    if (!id) { this.error = 'Falta el identificador de la transacción.'; return; }
    this.cargarTransaccion(id);
  }

  private cargarTransaccion(id: string): void {
    this.cargando = true;
    this.service.obtenerTransaccion(id, this.esAdmin ? undefined : localStorage.getItem('idContext') || undefined).subscribe({
      next: response => {
        const datos = response?.rows ?? response?.data ?? response;
        this.transaccion = Array.isArray(datos) ? datos[0] : datos;
        this.cargando = false;
        if (!this.transaccion) this.error = 'No se encontró la transacción.';
      },
      error: err => { this.cargando = false; this.error = err?.error?.message || 'No fue posible consultar la transacción.'; }
    });
  }

  cambiarTipo(): void {
    const tipo = this.tipo;
    this.form.controls.motivo.setValue('');
    this.motivos = [];
    this.error = '';
    if (tipo === 'D' || tipo === 'CC') {
      this.form.controls.monto.setValue(this.montoOriginal.toFixed(2));
      this.form.controls.monto.disable();
    } else {
      this.form.controls.monto.reset('');
      this.form.controls.monto.enable();
    }
    if (tipo === 'CC') {
      this.form.controls.observaciones.setValidators(Validators.required);
    } else {
      this.form.controls.observaciones.clearValidators();
    }
    this.form.controls.observaciones.updateValueAndValidity();
    if (!tipo) return;
    this.service.obtenerMotivos(tipo).subscribe({
      next: response => {
        const datos = response?.rows ?? response?.data ?? response;
        this.motivos = Array.isArray(datos) ? datos : [];
      },
      error: () => { this.error = 'No fue posible consultar los motivos.'; }
    });
  }

  formatearMonto(): void {
    const control = this.form.controls.monto;
    const limpio = String(control.value ?? '').replace(/[^\d.]/g, '');
    const [entero, ...decimales] = limpio.split('.');
    control.setValue(decimales.length ? `${entero}.${decimales.join('').slice(0, 2)}` : entero, { emitEvent: false });
  }

  seleccionarArchivo(event: Event, indice: number): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.evidencias[indice] = archivo;
    else delete this.evidencias[indice];
  }

  agregarCampoEvidencia(): void { this.camposEvidencia.push(this.camposEvidencia.length); }

  prepararEnvio(): void {
    this.enviado = true;
    this.error = '';
    this.mensaje = '';
    this.form.markAllAsTouched();
    if (!this.tipo || this.form.invalid) return;
    const monto = this.tipo === 'DP' ? Number(this.form.controls.monto.value) : this.montoOriginal;
    if (!(monto > 0) || monto > this.montoOriginal) {
      this.error = 'El monto debe ser mayor a cero y no superar el monto original de la transacción.';
      return;
    }
    this.mostrarContrasena = true;
  }

  async guardar(): Promise<void> {
    if (!this.contrasena || this.guardando || this.guardada || !this.transaccion) {
      this.error = 'Captura tu contraseña para continuar.';
      return;
    }
    this.guardando = true;
    this.error = '';
    const email = localStorage.getItem('mail') || localStorage.getItem('email') || '';
    this.service.validarContrasena(email, this.contrasena,
      localStorage.getItem('latitud') || '', localStorage.getItem('longitud') || '').subscribe({
      next: async response => {
        if (response?.success !== true || Number(response?.idStatus ?? 0) !== 0) {
          this.guardando = false;
          this.error = Number(response?.idStatus) === 1 ? 'Primero debes verificar tu cuenta.' : response?.message || 'No se pudo validar la contraseña.';
          return;
        }
        try {
          const files = await this.archivosBase64();
          this.service.guardar({
            idOperation: String(this.transaccion.idOperation),
            idTransactionType: this.tipo as 'D' | 'DP' | 'CC',
            idCatClarification: Number(this.form.controls.motivo.value),
            authorizationPan: String(this.transaccion.card ?? ''),
            amount: this.tipo === 'DP' ? Number(this.form.controls.monto.value) : this.montoOriginal,
            observations: this.form.controls.observaciones.value || '',
            lastUserModify: localStorage.getItem('idUser') || '',
            idTerminalUser: Number(this.transaccion.tuuser),
            authNumber: String(this.transaccion.authorizationNumber ?? ''),
            retrievalReferenceCode: String(this.transaccion.authorizationRrcext ?? ''),
            ...(files.length ? { files } : {})
          }).subscribe({
            next: resultado => {
              this.guardando = false;
              const datos = resultado?.rows ?? resultado;
              if (datos?.success === false) { this.error = datos?.error?.message || 'No fue posible guardar la aclaración.'; return; }
              this.mostrarContrasena = false;
              this.contrasena = '';
              this.guardada = true;
              this.mensaje = `Aclaración exitosa. Número de autorización: ${datos?.printInfo?.authorizationNumber ?? this.transaccion.authorizationNumber ?? ''}`;
            },
            error: err => { this.guardando = false; this.error = err?.error?.message || 'No fue posible guardar la aclaración.'; }
          });
        } catch {
          this.guardando = false;
          this.error = 'No fue posible leer las evidencias.';
        }
      },
      error: err => { this.guardando = false; this.error = err?.error?.message || 'No se pudo validar la contraseña.'; }
    });
  }

  async guardarEvidencias(): Promise<void> {
    if (!this.cargo || this.guardando || !this.evidencias.some(Boolean)) {
      this.error = 'Selecciona al menos una evidencia.';
      return;
    }
    this.guardando = true;
    this.error = '';
    try {
      const files = await this.archivosBase64();
      this.service.agregarEvidencias(Number(this.cargo.idClarification), String(this.transaccion.idOperation), files).subscribe({
        next: response => {
          this.guardando = false;
          if (response?.success === false) { this.error = response?.error?.message || 'No fue posible guardar las evidencias.'; return; }
          this.mensaje = 'Evidencias guardadas correctamente.';
          this.evidencias = [];
          this.cargarTransaccion(String(this.transaccion.idOperation));
        },
        error: err => { this.guardando = false; this.error = err?.error?.message || 'No fue posible guardar las evidencias.'; }
      });
    } catch {
      this.guardando = false;
      this.error = 'No fue posible leer las evidencias.';
    }
  }

  private archivosBase64(): Promise<string[]> {
    return Promise.all(this.evidencias.filter(Boolean).map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
  }
}
