import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CajasService } from '../../services/cajas.service';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-cajas',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './cajas.component.html',
  styleUrls: ['./cajas.component.css']
})
export class CajasComponent implements OnInit {
  private cajasService = inject(CajasService);

  subafiliados: any[] = [];
  entidades: any[] = [];
  sucursales: any[] = [];
  cajas: any[] = [];

  filtros = {
    subafiliado: '',
    entidad: '',
    sucursal: '',
    rfc: '',
    email: '',
    tel: '',
    fechaInicio: '',
    fechaFin: ''
  };

  cargando = false;
  mensaje = 'No hay elementos disponibles.';
  mensajeError = '';
  mostrarTabla = false;
  paginaActual = 1;
  elementosPorPagina = 10;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.cajas.length / this.elementosPorPagina));
  }

  get cajasPaginadas(): any[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.cajas.slice(inicio, inicio + this.elementosPorPagina);
  }

  get paginas(): number[] {
    return Array.from(
      { length: this.totalPaginas },
      (_, index) => index + 1
    );
  }

  ngOnInit(): void {
    this.cargarSubafiliados();
  }

  cargarSubafiliados(): void {
    const idRol = Number(localStorage.getItem('idRol') || 0);
    const idContext = Number(localStorage.getItem('idContext') || 0);

    const request$: Observable<any> = idRol === 2 || !idContext
      ? this.cajasService.getSubafiliados()
      : this.cajasService.getSubafiliadoById(idContext);

    request$.subscribe({
      next: (resp: any) => {
     //   console.log('Subafiliados cajas:', resp);
        this.subafiliados = this.normalizarSubafiliados(resp);

        if (idRol !== 2 && idContext) {
          this.filtros.subafiliado = String(idContext);
          this.cargarEntidades();
        }
      },
      error: (error) => console.error('Error al cargar subafiliados:', error)
    });
  }

  cargarEntidades(): void {
    const subafiliado = Number(this.filtros.subafiliado);
    this.entidades = [];
    this.sucursales = [];
    this.filtros.entidad = '';
    this.filtros.sucursal = '';

    if (!subafiliado) {
      return;
    }

    this.cajasService.getEntidades(subafiliado).subscribe({
      next: (resp: any) => {
       // console.log('Entidades cajas:', resp);
        this.entidades = this.normalizarLista(resp, ['rows', 'entities', 'entityResponse', 'contextResponse', 'data']);
      },
      error: (error) => console.error('Error al cargar entidades:', error)
    });
  }

  cargarSucursales(): void {
    const subafiliado = Number(this.filtros.subafiliado);
    const entidad = Number(this.filtros.entidad);
    this.sucursales = [];
    this.filtros.sucursal = '';

    if (!subafiliado || !entidad) {
      return;
    }

    this.cajasService.getSucursales(subafiliado, entidad).subscribe({
      next: (resp: any) => {
     //   console.log('Sucursales cajas:', resp);
        this.sucursales = this.normalizarLista(resp, ['rows', 'branchOffices', 'branchOfficeResponse', 'contextResponse', 'data']);
      },
      error: (error) => console.error('Error al cargar sucursales:', error)
    });
  }

  buscar(): void {
    this.cargando = true;
    this.mostrarTabla = false;
    this.mensajeError = '';
    this.mensaje = 'Buscando cajas...';

    this.cajasService.buscarCajas(this.filtros).subscribe({
      next: (resp: any) => {
        // Los datos de la tabla salen de este endpoint: entity/searchCommercesByLevel.
        this.cajas = this.normalizarLista(resp, ['rows', 'entities', 'entityResponse', 'contextResponse', 'data']);
        this.paginaActual = 1;
        this.cargando = false;

        if (this.cajas.length) {
          this.mostrarTabla = true;
          this.mensaje = '';
        } else {
          this.mensajeError = 'No se encontraron resultados';
          this.mensaje = 'No se encontraron resultados.';
        }
      },
      error: (error) => {
        console.error('Error al buscar cajas:', error);
        this.cajas = [];
        this.mensaje = 'Error al cargar cajas.';
        this.mensajeError = 'Ocurrió un error al consultar la información';
        this.cargando = false;
      }
    });
  }

  onFechaInicioChange(event: any): void {
    this.filtros.fechaInicio = event?.dateStr || '';
  }

  onFechaFinChange(event: any): void {
    this.filtros.fechaFin = event?.dateStr || '';
  }

  limpiar(): void {
    this.filtros = {
      subafiliado: '',
      entidad: '',
      sucursal: '',
      rfc: '',
      email: '',
      tel: '',
      fechaInicio: '',
      fechaFin: ''
    };
    this.entidades = [];
    this.sucursales = [];
    this.cajas = [];
    this.paginaActual = 1;
    this.mostrarTabla = false;
    this.mensajeError = '';
    this.mensaje = 'No hay elementos disponibles.';
  }

  exportarExcel(): void {
    if (!this.cajas.length) {
      return;
    }

    const fecha = this.obtenerFechaArchivo();
    const data = [
      [`Cajas-${fecha}`],
      this.encabezadosExportacion,
      ...this.obtenerFilasExportacion()
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: this.encabezadosExportacion.length - 1 } }];
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 34 },
      { wch: 24 },
      { wch: 18 },
      { wch: 22 },
      { wch: 42 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lista Cajas');
    XLSX.writeFile(workbook, `Cajas-${fecha}.xlsx`);
  }

  exportarPDF(): void {
    if (!this.cajas.length) {
      return;
    }

    const fecha = this.obtenerFechaArchivo();
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(20);
    doc.text(`Cajas-${fecha}`, 148, 23, { align: 'center' });

    autoTable(doc, {
      startY: 30,
      styles: {
        fontSize: 12,
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
      head: [this.encabezadosExportacion],
      body: this.obtenerFilasExportacion()
    });

    doc.save(`Cajas-${fecha}.pdf`);
  }

  imprimir(): void {
    if (!this.cajas.length) {
      return;
    }

    const fecha = this.obtenerFechaArchivo();
    const filas = this.obtenerFilasExportacion()
      .map(fila => `
        <tr>
          ${fila.map(valor => `<td>${this.escapeHtml(valor)}</td>`).join('')}
        </tr>
      `)
      .join('');

    const ventana = window.open('', '_blank', 'width=1200,height=800');

    if (!ventana) {
      return;
    }

    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Cajas-${fecha}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 28px; color: #000; }
            h1 { margin: 0 0 28px; font-size: 56px; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d9dee5; padding: 18px 16px; text-align: left; vertical-align: middle; }
            th { font-size: 18px; font-weight: 800; text-transform: uppercase; }
            td { font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>KashPay</h1>
          <table>
            <thead>
              <tr>${this.encabezadosExportacion.map(titulo => `<th>${titulo}</th>`).join('')}</tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  cambiarPagina(page: number): void {
    this.paginaActual = page;
  }

  onAccionChange(accion: string, caja: any): void {
    if (!accion) {
      return;
    }

    console.log('Acción caja:', accion, caja);
  }

  obtenerSubafiliadoId(item: any): string {
    return String(item?.idContext ?? item?.idSubAffiliation ?? item?.id ?? '');
  }

  obtenerSubafiliadoTexto(item: any): string {
    return item?.contextDescription || item?.description || item?.name || this.obtenerSubafiliadoId(item);
  }

  obtenerEntidadId(item: any): string {
    return String(item?.idEntity ?? item?.id ?? item?.entityID ?? '');
  }

  obtenerEntidadTexto(item: any): string {
    return item?.entityDescription || item?.businessName || item?.bussinesName || item?.name || this.obtenerEntidadId(item);
  }

  obtenerSucursalId(item: any): string {
    return String(item?.idTerminal ?? item?.id ?? item?.terminalID ?? '');
  }

  obtenerSucursalTexto(item: any): string {
    return item?.businessName || item?.terminalDescription || item?.name || this.obtenerSucursalId(item);
  }

  obtenerNombreCaja(item: any): string {
    return item?.tuName || item?.terminalUserName || item?.name || item?.businessName || item?.bussinesName || item?.commercialName || item?.commerceName || 'ND';
  }

  obtenerEmail(item: any): string {
    return item?.email || item?.mail || item?.payEmail || item?.contactEmail || item?.userEmail || 'ND';
  }

  obtenerModeloNegocio(item: any): string {
    return item?.businessModel || item?.businessModelDescription || item?.businessModelName || item?.idbusinessModel || item?.idBusinessModel || 'ND';
  }

  obtenerTelefono(item: any): string {
    return item?.phone || item?.phoneNumber || item?.telephoneNumber || item?.telephone || item?.tel || item?.payPhone || item?.cellphone || 'ND';
  }

  obtenerFecha(item: any): string {
    return item?.createdAt || item?.creationDate || item?.dateTimeCreator || item?.date || item?.fechaAlta || 'ND';
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}:${String(fecha.getSeconds()).padStart(2, '0')}`;
  }

  private readonly encabezadosExportacion = [
    'Nombre',
    'Email',
    'Modelo de Negocio',
    'Teléfono',
    'Fecha',
    'Acciones'
  ];

  private obtenerFilasExportacion(): string[][] {
    return this.cajas.map(caja => [
      this.obtenerNombreCaja(caja),
      this.obtenerEmail(caja),
      this.obtenerModeloNegocio(caja),
      this.obtenerTelefono(caja),
      this.obtenerFecha(caja),
      'Editar Información / Segmento / Deshabilitar'
    ]);
  }

  private escapeHtml(value: unknown): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private normalizarSubafiliados(resp: any): any[] {
    return this.normalizarLista(resp, ['contextResponse', 'rows', 'data', 'subafiliado']);
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    for (const key of keys) {
      if (Array.isArray(response?.[key])) {
        return response[key];
      }

      if (response?.[key] && typeof response[key] === 'object') {
        return [response[key]];
      }
    }

    for (const value of Object.values(response || {})) {
      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = this.normalizarLista(value, keys);

        if (nested.length) {
          return nested;
        }
      }
    }

    return [];
  }
}
