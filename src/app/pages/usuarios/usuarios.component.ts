import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UsuariosService } from '../../services/usuarios.service';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerComponent, SelectComponent],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  formulario: FormGroup;
  entidades: any[] = [];
  tiposOperacion: any[] = [];
  estatus: any[] = [];
  operaciones: any[] = [];
  usuarios: any[] = [];
  mostrarTabla = false;
  mensajeError = '';
  cargando = false;
  tipoBusquedaSeleccionado = '0';
  paginaActual = 1;
  totalPaginas = 1;
  totalRegistros = 0;
  paginas: Array<number | string> = [];
  accionesAbiertas = '';

  typeSearchOptions = [
    { label: 'Rango de fecha', value: '0' },
    { label: 'Correo Electrónico', value: '1' },
    { label: 'Teléfono', value: '2' },
    { label: 'Estatus', value: '3' }
  ];

  //$arraystatus = array('Activo','Bloqueado','Inactivo','Revisando','Verificado','Fallo envio SCUD',
  // 'Pendiente por revisar core','Estatus diferente de verified','Fallo alta web','Rechazado por SCUD');
  //$arraystatusid = array(1,3,14,18,19,20,21,22,23,24);
  estatusOptions = [
    { id: 1, nombre: 'Activo' },
    { id: 3, nombre: 'Bloqueado' },
    { id: 14, nombre: 'Inactivo' },
    { id: 18, nombre: 'Revisando' },
    { id: 19, nombre: 'Verificado' },
    { id: 20, nombre: 'Fallo envio SCUD' },
    { id: 21, nombre: 'Pendiente por revisar core' },
    { id: 22, nombre: 'Estatus diferente de verified' },
    { id: 23, nombre: 'Fallo alta web' },
    { id: 24, nombre: 'Rechazado por SCUD' }
  ];

  accionesOptions = [
    { label: 'Reenvio de token', value: 'token' },
    { label: 'Actualizar correo electrónico', value: 'correo' }
  ];

  get estatusSelectOptions() {
    return this.estatusOptions.map(estatus => ({
      label: estatus.nombre,
      value: String(estatus.id)
    }));
  }

  get entidadesSelectOptions() {
    return this.entidades.map(entidad => ({
      label: entidad.bundle,
      value: entidad.bundle
    }));
  }

  seleccionados: number[] = [];

  onSelectionChange() {
    console.log('Seleccionados:', this.seleccionados);
  }

  private usuariosService = inject(UsuariosService);


  constructor(
    private fb: FormBuilder,
    //private usuariosService: UsuariosService
  ) {

    this.formulario = this.fb.group({
      entidad: [''],
      typeSearch: ['0'],
      value1F: [''],
      value2F: ['']
    });
  }

  ngOnInit(): void {

    this.cargarDatosIniciales();

    this.formulario.get('typeSearch')?.valueChanges.subscribe(tipo => {

      this.tipoBusquedaSeleccionado = tipo;

      this.formulario.patchValue({
        value1F: '',
        value2F: ''
      });

    });

  }

  cargarDatosIniciales(): void {
    // Cargar cuentas
    this.usuariosService.obtenerEntidades().subscribe({
      next: (data) => {
        this.entidades = data;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
      }
    });

    // Cargar tipos de operación
    /*this.usuariosService.obtenerTiposOperacion().subscribe({
      next: (data) => {
        this.tiposOperacion = data;
      },
      error: (error) => {
        console.error('Error al cargar tipos de operación:', error);
      }
    });

    // Cargar estatus
    this.transEmiService.obtenerStatus().subscribe({
      next: (data) => {
        this.estatus = data;
      },
      error: (error) => {
        console.error('Error al cargar estatus:', error);
      }
    });*/
  }



  onSubmit(): void {
    console.log('Formulario ');
    console.log(this.formulario.value);

    this.mensajeError = '';

    if (!this.validarFechasBusqueda()) {
      this.mostrarTabla = false;
      return;
    }

    this.cargando = true;
    this.mostrarTabla = false;

    this.usuariosService.enviarFormulario(this.formulario.value)
      .subscribe({

        next: (response) => {

          this.usuarios = this.filtrarUsuariosPorEstatus(response.content || []);
          this.totalRegistros = this.esBusquedaPorEstatus()
            ? this.usuarios.length
            : (response.totalElements || this.usuarios.length);
          this.totalPaginas = this.esBusquedaPorEstatus()
            ? (this.usuarios.length ? 1 : 0)
            : (response.totalPages || 1);

          this.paginas = this.obtenerPaginas();
          this.cargando = false;

          if (this.usuarios.length > 0) {

            this.mostrarTabla = true;

          } else {

            this.mensajeError =
              'No se encontraron registros para los filtros seleccionados';
            this.mostrarTabla = false;

          }

        },

        error: () => {

          this.cargando = false;

          this.mensajeError =
            'Ocurrió un error al consultar la información';

        }

      });

  }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPaginas || page === this.paginaActual) {
      return;
    }

    this.paginaActual = page;

    this.usuariosService
      .enviarFormulario(
        this.formulario.value,
        this.paginaActual
      )
      .subscribe({

        next: (response) => {

          this.usuarios = this.filtrarUsuariosPorEstatus(response.content || []);
          this.totalRegistros = this.esBusquedaPorEstatus()
            ? this.usuarios.length
            : (response.totalElements || this.totalRegistros || this.usuarios.length);
          this.totalPaginas = this.esBusquedaPorEstatus()
            ? (this.usuarios.length ? 1 : 0)
            : (response.totalPages || this.totalPaginas);
          this.paginas = this.obtenerPaginas();

        }

      });

  }

  cambiarPaginaPaginador(page: number | string): void {
    if (typeof page !== 'number') return;
    this.cambiarPagina(page);
  }

  private obtenerPaginas(): Array<number | string> {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    if (total <= 0) return [];

    const paginasVisibles = new Set<number>([1, total]);

    for (let pagina = actual - 2; pagina <= actual + 2; pagina++) {
      if (pagina > 1 && pagina < total) {
        paginasVisibles.add(pagina);
      }
    }

    const paginasOrdenadas = Array.from(paginasVisibles).sort((a, b) => a - b);
    return paginasOrdenadas.reduce<Array<number | string>>((paginas, pagina, index) => {
      const paginaAnterior = paginasOrdenadas[index - 1];
      if (index > 0 && pagina - paginaAnterior > 1) {
        paginas.push('...');
      }
      paginas.push(pagina);
      return paginas;
    }, []);
  }

  /*cargarTiposOperacion(): void {
    this.transEmiService.obtenerTiposOperacion().subscribe({
      next: (response: any) => {
        // Acceder a catOperationTypes dentro de la respuesta
        this.tiposOperacion = response.catOperationTypes || [];
        console.log('Tipos de operación:', this.tiposOperacion);
      },
      error: (error) => {
        console.error('Error:', error);
        this.tiposOperacion = [];
      }
    });
  }*/

  onFechaInicioChange(event: any): void {

    this.formulario.patchValue({
      value1F: event.dateStr.split(' ')[0]
    });

  }

  onFechaFinChange(event: any): void {

    this.formulario.patchValue({
      value2F: event.dateStr.split(' ')[0]
    });

  }

  private validarFechasBusqueda(): boolean {
    if (this.formulario.get('typeSearch')?.value !== '0') {
      return true;
    }

    const fechaInicioTexto = this.formulario.get('value1F')?.value;
    const fechaFinTexto = this.formulario.get('value2F')?.value;

    if (!fechaInicioTexto || !fechaFinTexto) {
      this.mensajeError = 'Selecciona fecha inicio y fecha fin para buscar.';
      return false;
    }

    const fechaInicio = this.obtenerFechaFiltro(fechaInicioTexto);
    const fechaFin = this.obtenerFechaFiltro(fechaFinTexto);

    if (!fechaInicio || !fechaFin) {
      this.mensajeError = 'Selecciona una fecha valida.';
      return false;
    }

    if (fechaInicio.getTime() > Date.now() || fechaFin.getTime() > Date.now()) {
      this.mensajeError = 'No puedes seleccionar una fecha mayor a la fecha actual.';
      return false;
    }

    if (fechaFin.getTime() < fechaInicio.getTime()) {
      this.mensajeError = 'La fecha fin no puede ser anterior a la fecha inicio.';
      return false;
    }

    return true;
  }

  esMensajeValidacion(): boolean {
    return [
      'Selecciona fecha inicio y fecha fin para buscar.',
      'Selecciona una fecha valida.',
      'No puedes seleccionar una fecha mayor a la fecha actual.',
      'La fecha fin no puede ser anterior a la fecha inicio.'
    ].includes(this.mensajeError);
  }

  private obtenerFechaFiltro(value: unknown): Date | null {
    const texto = String(value ?? '').trim();
    if (!texto) return null;

    const fecha = new Date(texto.replace(' ', 'T'));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  /*
    reenviarToken(usuario: any): void {
  
      console.log(
        'Reenvio token',
        usuario
      );
  
    }

    actualizarCorreo(usuario: any): void {
  
      console.log(
        'Actualizar correo',
        usuario
      );
  
    }*/

  exportarPDF(): void {

    const fecha = this.obtenerFechaArchivo();

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });


    // Subtítulo como el PHP
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Usuarios-${fecha}`, 148, 23, { align: 'center' });

    autoTable(doc, {

      startY: 30,

      styles: {
        fontSize: 7,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle'
      },

      headStyles: {
        fillColor: [44, 62, 80], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },

      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },

      bodyStyles: {
        textColor: [40, 40, 40]
      },

      columnStyles: {
        0: { cellWidth: 24 }, // INE
        1: { cellWidth: 32 }, // Nombre
        2: { cellWidth: 18 }, // Afiliación
        3: { cellWidth: 28 }, // Nombre afiliación
        4: { cellWidth: 38 }, // Email
        5: { cellWidth: 22 }, // Teléfono
        6: { cellWidth: 25 }, // Fecha
        7: { cellWidth: 28 }, // CURP
        8: { cellWidth: 22 }, // Tarjeta
        9: { cellWidth: 20 }, // Cuenta
        10: { cellWidth: 18 }, // Token
        11: { cellWidth: 18 } // Estatus
      },

      head: [[
        '# DE INE',
        'NOMBRE',
        '# AFILIACIÓN',
        'NOMBRE AFILIACIÓN',
        'EMAIL',
        'TELÉFONO',
        'FECHA REGISTRO',
        'CURP',
        'TARJETA',
        'CUENTA',
        'TOKEN',
        'ESTATUS'
      ]],

      body: this.usuarios.map(usuario => [

        usuario.dni ?? '',

        `${usuario.userName ?? ''} ${usuario.firstName ?? ''} ${usuario.lastName ?? ''}`,

        usuario.affiliationId ?? '',

        usuario.affiliationName ?? '',

        usuario.email ?? '',

        usuario.telephoneNumber ?? '',

        usuario.dateTimeCreator ?? '',

        usuario.curp ?? '',

        usuario.maskedCard ?? '',

        usuario.numCuenta ?? '',

        usuario.registrationCompletToken ?? '',

        usuario.status ?? ''

      ])

    });

    doc.save(`Usuarios-${fecha}.pdf`);

  }

  imprimir(): void {

  const tabla =
    document.querySelector(
      '.transactions-table'
    )?.outerHTML;

  if (!tabla) {
    return;
  }

  const ventana =
    window.open(
      '',
      '_blank',
      'width=1200,height=800'
    );

  if (!ventana) {
    return;
  }

  ventana.document.write(`
    <html>
      <head>
        <title>KashPay</title>

        <style>

          body{
            font-family: Arial, sans-serif;
            padding:20px;
          }

          h2{
            text-align:center;
          }

          table{
            width:100%;
            border-collapse:collapse;
          }

          th,td{
            border:1px solid #ddd;
            padding:6px;
            font-size:12px;
          }

          th{
            background:#f2f2f2;
          }

        </style>

      </head>

      <body>

        <h2>KashPay</h2>

        ${tabla}

      </body>

    </html>
  `);

  ventana.document.close();

  ventana.focus();

  setTimeout(() => {

    ventana.print();

  }, 500);

}

  exportarExcel(): void {

    const fecha =
      this.obtenerFechaArchivo();

    const datos = this.usuarios.map(usuario => ({

      '# DE INE': usuario.dni,

      'NOMBRE':
        `${usuario.userName ?? ''} ${usuario.firstName ?? ''} ${usuario.lastName ?? ''}`,

      '# DE AFILIACION':
        usuario.affiliationId,

      'NOMBRE DE AFILIACION':
        usuario.affiliationName,

      'EMAIL':
        usuario.email,

      'TELEFONO':
        usuario.telephoneNumber,

      'FECHA REGISTRO':
        usuario.dateTimeCreator,

      'CURP':
        usuario.curp,

      'TARJETA':
        usuario.maskedCard,

      'NUMERO DE CUENTA':
        usuario.numCuenta,

      'TOKEN':
        usuario.registrationCompletToken,

      'ESTATUS':
        usuario.status

    }));

    const worksheet =
      XLSX.utils.json_to_sheet(datos);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Usuarios'
    );

    XLSX.writeFile(
      workbook,
      `Usuarios-${fecha}.xlsx`
    );

  }

  private obtenerFechaArchivo(): string {

    const fecha = new Date();

    const year = fecha.getFullYear();

    const month =
      String(fecha.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(fecha.getDate())
        .padStart(2, '0');

    const hour =
      String(fecha.getHours())
        .padStart(2, '0');

    const minute =
      String(fecha.getMinutes())
        .padStart(2, '0');

    const second =
      String(fecha.getSeconds())
        .padStart(2, '0');

    return `${year}-${month}-${day} ${hour}${minute}${second}`;

  }

  limpiarFormulario(): void {

    this.formulario.reset({
      entidad: '',
      typeSearch: '0',
      value1F: '',
      value2F: ''
    });

    this.tipoBusquedaSeleccionado = '0';

    this.usuarios = [];
    this.totalRegistros = 0;

    this.mostrarTabla = false;

    this.mensajeError = '';
    this.accionesAbiertas = '';

  }


  onAccionChange(accion: string, usuario: any): void {

    if (!accion || !this.esUsuarioActivo(usuario)) {
      this.accionesAbiertas = '';
      return;
    }

    if (accion === 'token') {
      this.reenviarToken(usuario);

    }

    if (accion === 'correo') {
      this.actualizarCorreo(usuario);
    }

    if (accion === 'bloquear') {
      this.bloquearUsuario(usuario);
    }

    this.accionesAbiertas = '';
  }

  toggleAcciones(usuario: any): void {
    const idUsuario = this.obtenerUsuarioId(usuario);
    this.accionesAbiertas = this.accionesAbiertas === idUsuario ? '' : idUsuario;
  }

  esUsuarioActivo(usuario: any): boolean {
    const status = String(usuario?.status ?? usuario?.statusDescription ?? usuario?.idStatus ?? '').trim().toLowerCase();
    return status === '1' || status === 'activo' || status === 'active';
  }

  private filtrarUsuariosPorEstatus(usuarios: any[]): any[] {
    if (!this.esBusquedaPorEstatus()) {
      return usuarios;
    }

    const estatusSeleccionado = String(this.formulario.get('value1F')?.value ?? '');
    const estatusNombre = this.estatusOptions.find(estatus => String(estatus.id) === estatusSeleccionado)?.nombre ?? '';
    const estatusNormalizado = this.normalizarTexto(estatusNombre);

    return usuarios.filter(usuario => {
      const idStatus = String(usuario?.idStatus ?? usuario?.statusId ?? '');
      const status = this.normalizarTexto(usuario?.status ?? usuario?.statusDescription ?? '');

      return idStatus === estatusSeleccionado || (!!estatusNormalizado && status === estatusNormalizado);
    });
  }

  private esBusquedaPorEstatus(): boolean {
    return this.formulario.get('typeSearch')?.value === '3';
  }

  private normalizarTexto(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  obtenerUsuarioId(usuario: any): string {
    return String(usuario?.idUser ?? usuario?.userId ?? usuario?.id ?? usuario?.dni ?? usuario?.email ?? '');
  }

  private reenviarToken(usuario: any): void {
    if (!this.esUsuarioActivo(usuario)) return;

    const email = String(usuario?.email ?? '');
    const dni = String(usuario?.dni ?? '');
    const contexto = this.obtenerContextoUsuario(usuario);

    this.usuariosService.sendToken(contexto, email, dni).subscribe({
      next: () => {
        this.mensajeError = 'Token enviado correctamente.';
      },
      error: error => {
        console.error('Error al reenviar token:', error);
        this.mensajeError = 'No fue posible reenviar el token.';
      }
    });
  }

  private actualizarCorreo(usuario: any): void {
    if (!this.esUsuarioActivo(usuario)) return;

    const idUser = this.obtenerUsuarioId(usuario);
    const emailOrigin = String(usuario?.email ?? '');
    const emailUpdate = window.prompt('Nuevo correo electrónico', emailOrigin);

    if (!emailUpdate || emailUpdate.trim() === emailOrigin) {
      return;
    }

    this.usuariosService.updateEmail(idUser, emailOrigin, emailUpdate.trim()).subscribe({
      next: () => {
        usuario.email = emailUpdate.trim();
        this.mensajeError = 'Correo actualizado correctamente.';
      },
      error: error => {
        console.error('Error al actualizar correo:', error);
        this.mensajeError = 'No fue posible actualizar el correo.';
      }
    });
  }

  private bloquearUsuario(usuario: any): void {
    if (!this.esUsuarioActivo(usuario)) return;

    const confirmado = window.confirm('¿Deseas bloquear este usuario?');
    if (!confirmado) return;

    const idUser = this.obtenerUsuarioId(usuario);
    const contexto = this.obtenerContextoUsuario(usuario);

    this.usuariosService.blockUser(idUser, contexto).subscribe({
      next: () => {
        usuario.status = 'Bloqueado';
        this.mensajeError = 'Usuario bloqueado correctamente.';
      },
      error: error => {
        console.error('Error al bloquear usuario:', error);
        this.mensajeError = 'No fue posible bloquear el usuario.';
      }
    });
  }

  private obtenerContextoUsuario(usuario: any): string {
    return String(
      usuario?.idContext ??
      usuario?.context ??
      usuario?.contextId ??
      usuario?.affiliationId ??
      this.formulario.get('entidad')?.value ??
      localStorage.getItem('idContext') ??
      ''
    );
  }
}
