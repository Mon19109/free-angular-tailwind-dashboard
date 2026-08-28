import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { BeneficiarioForm, BeneficiariosService } from '../../services/beneficiarios.service';

type VistaBeneficiarios = 'lista' | 'agregar' | 'eliminar' | 'estatus';

@Component({
  selector: 'app-beneficiarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './beneficiarios.component.html',
  styleUrls: ['./beneficiarios.component.css']
})
export class BeneficiariosComponent implements OnInit {
  private beneficiariosService = inject(BeneficiariosService);

  vista: VistaBeneficiarios = 'lista';
  contactos: any[] = [];
  giros: any[] = [];
  actividades: any[] = [];
  instituciones: any[] = [];
  estatusRows: any[] = [];
  idsEliminar = new Set<string>();
  mensaje = '';
  error = '';
  cargando = false;
  buscandoInstitucion = false;
  estatusFileKey = '';
  altaMasiva = false;

  form: BeneficiarioForm = this.formInicial();

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargarContactos();
    this.beneficiariosService.obtenerGiros().subscribe({
      next: resp => this.giros = this.normalizarLista(resp, ['rows', 'data', 'giros', 'catGiroResponse']),
      error: error => console.error('Error al cargar giros:', error)
    });
    this.beneficiariosService.obtenerActividades().subscribe({
      next: resp => this.actividades = this.normalizarLista(resp, ['catActividadResponse', 'rows', 'data', 'actividades']),
      error: error => console.error('Error al cargar actividades:', error)
    });
  }

  cargarContactos(): void {
    const idUser = this.obtenerIdentificadorContactos();
    if (!idUser) {
      this.error = 'No se encontró el usuario de sesión.';
      return;
    }

    this.cargando = true;
    this.beneficiariosService.obtenerContactos(idUser).subscribe({
      next: resp => {
        this.contactos = this.normalizarLista(resp, ['contactResponse', 'contacts', 'rows', 'data', 'beneficiarios']);
        this.cargando = false;
      },
      error: error => {
        console.error('Error al cargar beneficiarios:', error);
        this.error = 'No fue posible cargar los beneficiarios.';
        this.cargando = false;
      }
    });
  }

  cambiarVista(vista: VistaBeneficiarios): void {
    this.vista = vista;
    this.mensaje = '';
    this.error = '';
  }

  buscarBanco(): void {
    this.error = '';
    this.instituciones = [];
    this.form.institucion = '';
    this.form.nameIns = '';
    this.form.accountNumber = '';

    if (!this.form.cuenta) {
      this.error = 'Captura una cuenta o tarjeta para buscar el banco.';
      return;
    }

    this.buscandoInstitucion = true;
    this.beneficiariosService.buscarInstitucion(this.form.cuenta).pipe(
      finalize(() => this.buscandoInstitucion = false)
    ).subscribe({
      next: resp => {
        if (resp?.success === false) {
          this.error = resp?.error?.message || 'No fue posible buscar el banco.';
          return;
        }

        const institutionResponse = resp?.institutionResponse
          || resp?.data?.institutionResponse
          || resp?.data
          || resp;
        this.instituciones = Array.isArray(institutionResponse?.institutions)
          ? institutionResponse.institutions
          : [];

        if (!this.instituciones.length) {
          this.error = 'No se encontraron instituciones para la cuenta capturada.';
          return;
        }

        if (this.instituciones.length === 1) {
          const institucion = this.instituciones[0];
          this.form.institucion = this.obtenerInstitucionId(institucion);
          this.form.nameIns = this.obtenerInstitucionTexto(institucion);
          this.form.accountNumber = String(institutionResponse?.idEntity || this.form.cuenta);
        }
      },
      error: error => {
        console.error('Error al buscar institución:', error);
        this.error = 'No fue posible buscar el banco.';
      }
    });
  }

  seleccionarInstitucion(id: string): void {
    this.form.institucion = id;
    const institucion = this.instituciones.find(item => this.obtenerInstitucionId(item) === id);
    this.form.nameIns = this.obtenerInstitucionTexto(institucion);
    if (id) this.form.accountNumber = this.form.cuenta;
  }

  agregar(): void {
    this.mensaje = '';
    this.error = '';

    if (!this.formularioValido()) {
      this.error = 'Completa los campos obligatorios para agregar el beneficiario.';
      return;
    }

    const idUser = this.obtenerIdUser();
    if (!idUser) {
      this.error = 'No se encontró el usuario de sesión.';
      return;
    }

    this.cargando = true;
    this.beneficiariosService.agregarContacto(idUser, this.form).subscribe({
      next: () => {
        this.mensaje = 'Beneficiario agregado correctamente.';
        this.form = this.formInicial();
        this.instituciones = [];
        this.cargando = false;
        this.cargarContactos();
        this.vista = 'lista';
      },
      error: error => {
        console.error('Error al agregar beneficiario:', error);
        this.error = 'No fue posible agregar el beneficiario.';
        this.cargando = false;
      }
    });
  }

  toggleEliminar(id: string, checked: boolean): void {
    if (checked) {
      this.idsEliminar.add(id);
    } else {
      this.idsEliminar.delete(id);
    }
  }

  eliminarSeleccionados(): void {
    this.mensaje = '';
    this.error = '';
    const ids = Array.from(this.idsEliminar);

    if (!ids.length) {
      this.error = 'Selecciona al menos un beneficiario para eliminar.';
      return;
    }

    this.cargando = true;
    this.beneficiariosService.eliminarContactos(ids).subscribe({
      next: () => {
        this.mensaje = 'Beneficiarios eliminados correctamente.';
        this.idsEliminar.clear();
        this.cargando = false;
        this.cargarContactos();
        this.vista = 'lista';
      },
      error: error => {
        console.error('Error al eliminar beneficiarios:', error);
        this.error = 'No fue posible eliminar los beneficiarios.';
        this.cargando = false;
      }
    });
  }

  consultarEstatus(): void {
    this.estatusRows = [];
    this.mensaje = '';
    this.error = '';

    if (!this.estatusFileKey.trim()) {
      this.error = 'Captura el nombre del archivo para consultar el estatus.';
      return;
    }

    this.beneficiariosService.consultarEstatus(this.estatusFileKey.trim()).subscribe({
      next: resp => {
        this.estatusRows = this.normalizarLista(resp, ['rows', 'data', 'detailContactFileResponse', 'contactFileResponse']);
        if (!this.estatusRows.length) this.mensaje = 'No se encontraron resultados.';
      },
      error: error => {
        console.error('Error al consultar estatus:', error);
        this.error = 'No fue posible consultar el estatus.';
      }
    });
  }

  obtenerContactoId(contacto: any): string {
    return String(contacto?.idContact ?? contacto?.id ?? contacto?.contactId ?? '');
  }

  obtenerTitular(contacto: any): string {
    return contacto?.fullName || contacto?.name || 'ND';
  }

  obtenerAlias(contacto: any): string {
    return contacto?.nameAlias || contacto?.alias || 'ND';
  }

  obtenerCuenta(contacto: any): string {
    const cuenta = String(contacto?.cardNumberMask || contacto?.accountNumberMask || contacto?.accountNumber || contacto?.cardNumber || '');
    if (!cuenta) return 'ND';
    return cuenta.includes('*') ? cuenta : `**** ${cuenta.slice(-4)}`;
  }

  obtenerBanco(contacto: any): string {
    return contacto?.nameInstitution || contacto?.institutionName || contacto?.bankName || 'ND';
  }

  obtenerGiroId(giro: any): string {
    return String(giro?.giro ?? giro?.idGiro ?? giro?.id ?? '');
  }

  obtenerGiroTexto(giro: any): string {
    return giro?.familia || giro?.description || giro?.name || this.obtenerGiroId(giro);
  }

  obtenerDescripcionGiro(giro: any): string {
    return giro?.descripcion || giro?.description || giro?.familia || this.obtenerGiroTexto(giro);
  }

  obtenerActividadValor(actividad: any): string {
    const id = actividad?.idcat_actividades ?? actividad?.idActividad ?? actividad?.id ?? '';
    const texto = actividad?.actividad ?? actividad?.description ?? actividad?.name ?? '';
    return id && texto ? `${id}|${texto}` : String(id || texto);
  }

  obtenerActividadTexto(actividad: any): string {
    return actividad?.actividad || actividad?.description || actividad?.name || this.obtenerActividadValor(actividad);
  }

  obtenerInstitucionId(institucion: any): string {
    return String(institucion?.key ?? institucion?.idInstitution ?? institucion?.id ?? institucion?.institutionId ?? institucion?.code ?? '');
  }

  obtenerInstitucionTexto(institucion: any): string {
    if (!institucion) return '';
    return institucion?.name || institucion?.nameInstitution || institucion?.institutionName || institucion?.description || this.obtenerInstitucionId(institucion);
  }

  obtenerValorEstatus(row: any, keys: string[]): string {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null) return String(row[key]);
    }
    return 'ND';
  }

  private formularioValido(): boolean {
    const base = Boolean(
      this.form.nombre &&
      this.form.alias &&
      this.form.email &&
      this.form.rfc &&
      this.form.direccion &&
      this.form.tipoCuenta &&
      this.form.cuenta &&
      this.form.institucion &&
      this.form.dirBanco
    );

    if (!base) return false;
    if (this.form.tipoBen === 'PM') return Boolean(this.form.giro && this.form.desGiro);
    return Boolean(this.form.actividad);
  }

  private obtenerIdentificadorContactos(): string {
    const sessionRaw = localStorage.getItem('auth_session');

    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        const sessionId = session?.validate || session?.idUser || session?.userId;
        if (sessionId) return String(sessionId);
      } catch {
        // Se usan las llaves individuales como respaldo.
      }
    }

    return localStorage.getItem('validate')
      || localStorage.getItem('idUser')
      || localStorage.getItem('userId')
      || '';
  }

  private obtenerIdUser(): number {
    return Number(localStorage.getItem('idUser') || localStorage.getItem('userId') || 0);
  }

  private formInicial(): BeneficiarioForm {
    return {
      nombre: '',
      alias: '',
      email: '',
      rfc: '',
      direccion: '',
      tipoBen: 'PF',
      giro: '',
      desGiro: '',
      actividad: '',
      tipoCuenta: '',
      cuenta: '',
      institucion: '',
      nameIns: '',
      accountNumber: '',
      dirBanco: '',
      telefono: '',
      emailB: ''
    };
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) return response;

    for (const key of keys) {
      if (Array.isArray(response?.[key])) return response[key];
      if (response?.[key] && typeof response[key] === 'object') return [response[key]];
    }

    for (const value of Object.values(response || {})) {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') {
        const nested = this.normalizarLista(value, keys);
        if (nested.length) return nested;
      }
    }

    return [];
  }
}
