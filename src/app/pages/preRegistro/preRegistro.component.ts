import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

interface DocumentoRequerido {
  nombre: string;
  obligatorio: boolean;
  archivo?: File;
}

@Component({
  selector: 'app-preregistro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './preRegistro.component.html',
  styleUrls: ['./preRegistro.component.css'],
})
export class PreRegistroComponent {
  private readonly fb = inject(FormBuilder);

  pasoActual = 1;
  seccionAbierta: 'comercio' | 'generales' | null = 'comercio';
  mostrarComisionista = false;
  mostrarBusquedaGiro = false;
  registroTerminado = false;
  archivosInvalidos = false;

  readonly requisitos = [
    'Acta constitutiva para persona moral.',
    'Poder vigente del representante legal.',
    'Constancia de situación fiscal reciente y completa.',
    'Identificación oficial vigente del representante legal.',
    'Datos de contacto del representante legal.',
    'Comprobante de domicilio no mayor a 3 meses.',
    'Correo electrónico y teléfono móvil activos.',
  ];

  readonly niveles = ['Subafiliado', 'Pyme - Entidad', 'Sucursal'];
  readonly tiposComercio = ['Empresa Grupo', 'Persona Física'];
  readonly regimenes = [
    'General de Ley Personas Morales',
    'Régimen Simplificado de Confianza',
    'Personas Físicas con Actividades Empresariales',
  ];

  readonly documentos: DocumentoRequerido[] = [
    { nombre: 'Comprobante de domicilio', obligatorio: true },
    { nombre: 'Acta constitutiva', obligatorio: true },
    { nombre: 'Identificación oficial del propietario', obligatorio: true },
    { nombre: 'Contrato', obligatorio: false },
    { nombre: 'Imagen frente del comercio', obligatorio: false },
    { nombre: 'Imagen interior del comercio', obligatorio: false },
    { nombre: 'Imagen interior 2 del comercio', obligatorio: false },
    { nombre: 'Escrituras públicas', obligatorio: false },
    { nombre: 'Poder del representante', obligatorio: false },
    { nombre: 'Constancia de situación fiscal', obligatorio: false },
    { nombre: 'E-Firma', obligatorio: false },
    { nombre: 'Identificación oficial del representante legal', obligatorio: false },
    { nombre: 'Identificación oficial de un tercero', obligatorio: false },
  ];

  readonly afiliacionForm = this.fb.nonNullable.group({
    afiliacion: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
  });

  readonly comercioForm = this.fb.nonNullable.group({
    nivel: ['', Validators.required],
    tipoComercio: ['', Validators.required],
    afiliacionComisionista: [''],
  });

  readonly datosForm = this.fb.nonNullable.group(
    {
      correo: ['', [Validators.required, Validators.email]],
      confirmarCorreo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      rfc: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(13)]],
      razonSocial: ['', Validators.required],
      nombreComercial: ['', Validators.required],
      regimenFiscal: ['', Validators.required],
      familiaGiro: ['', Validators.required],
      descripcionGiro: ['', Validators.required],
      mcc: ['', Validators.required],
      codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      tipoVialidad: ['', Validators.required],
      vialidad: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      numeroInterior: [''],
      colonia: ['', Validators.required],
      localidad: ['', Validators.required],
      municipio: ['', Validators.required],
      estado: ['', Validators.required],
      entreCalle: ['', Validators.required],
      yCalle: ['', Validators.required],
      representanteNombre: ['', Validators.required],
      representantePaterno: ['', Validators.required],
      representanteMaterno: ['', Validators.required],
      representanteCorreo: ['', [Validators.required, Validators.email]],
      representanteTelefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      representanteTelefonoAdicional: [''],
    },
    { validators: this.correosCoinciden },
  );

  readonly comisionistaForm = this.fb.nonNullable.group({
    tipo: ['existente', Validators.required],
    afiliacion: [''],
    correo: [''],
    confirmarCorreo: [''],
    telefono: [''],
    nombre: [''],
    paterno: [''],
    materno: [''],
    rfc: [''],
  });

  readonly busquedaGiroForm = this.fb.nonNullable.group({
    termino: [''],
    resultado: [''],
  });

  readonly girosSugeridos = [
    { familia: 'Turismo', descripcion: 'Agencias de viajes', mcc: '4722' },
    { familia: 'Alimentos', descripcion: 'Restaurantes', mcc: '5812' },
    { familia: 'Comercio', descripcion: 'Tiendas de ropa', mcc: '5651' },
  ];

  private correosCoinciden(control: AbstractControl): ValidationErrors | null {
    const correo = control.get('correo')?.value;
    const confirmacion = control.get('confirmarCorreo')?.value;
    return correo && confirmacion && correo !== confirmacion ? { correosDistintos: true } : null;
  }

  continuarAfiliacion(): void {
    if (this.afiliacionForm.invalid) {
      this.afiliacionForm.markAllAsTouched();
      return;
    }
    this.pasoActual = 2;
  }

  continuarDocumentos(): void {
    if (this.comercioForm.invalid || this.datosForm.invalid) {
      this.comercioForm.markAllAsTouched();
      this.datosForm.markAllAsTouched();
      this.seccionAbierta = this.comercioForm.invalid ? 'comercio' : 'generales';
      return;
    }
    this.pasoActual = 3;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalizarRegistro(): void {
    this.archivosInvalidos = this.documentos.some(doc => doc.obligatorio && !doc.archivo);
    if (this.archivosInvalidos) return;
    this.registroTerminado = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volver(paso: number): void {
    this.pasoActual = paso;
    this.registroTerminado = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSeccion(seccion: 'comercio' | 'generales'): void {
    this.seccionAbierta = this.seccionAbierta === seccion ? null : seccion;
  }

  seleccionarArchivo(event: Event, documento: DocumentoRequerido): void {
    const input = event.target as HTMLInputElement;
    documento.archivo = input.files?.[0];
    this.archivosInvalidos = false;
  }

  guardarComisionista(): void {
    const valor = this.comisionistaForm.value;
    if (valor.tipo === 'existente') {
      this.comercioForm.patchValue({ afiliacionComisionista: valor.afiliacion || '' });
    } else {
      this.comercioForm.patchValue({ afiliacionComisionista: `Nuevo: ${valor.nombre || 'comisionista'}` });
    }
    this.mostrarComisionista = false;
  }

  seleccionarGiro(indice: number): void {
    this.busquedaGiroForm.patchValue({ resultado: String(indice) });
  }

  guardarGiro(): void {
    const indice = Number(this.busquedaGiroForm.value.resultado);
    const giro = this.girosSugeridos[indice];
    if (!giro) return;
    this.datosForm.patchValue({
      familiaGiro: giro.familia,
      descripcionGiro: giro.descripcion,
      mcc: giro.mcc,
    });
    this.mostrarBusquedaGiro = false;
  }

  esInvalido(formulario: 'afiliacion' | 'comercio' | 'datos', campo: string): boolean {
    const form: FormGroup = formulario === 'afiliacion'
      ? this.afiliacionForm
      : formulario === 'comercio'
        ? this.comercioForm
        : this.datosForm;
    const control = form.get(campo);
    return !!(control?.invalid && control.touched);
  }
}
