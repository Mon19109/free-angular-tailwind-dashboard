import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type NivelComercio = 'todos' | 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja';
type EstatusComercio = 'Activo' | 'Inactivo' | 'Baja definitiva';

interface Comercio {
  idComercio: string;
  nivel: 'Sub Afiliado' | 'Entidad' | 'Sucursal' | 'Caja';
  jerarquia: string;
  nombreComercial: string;
  razonSocial: string;
  rfc: string;
  correo: string;
  telefono: string;
  estatus: EstatusComercio;
  cajaPinRapido?: boolean;
  password?: string;
  tieneInferiores?: boolean;
}

@Component({
  selector: 'app-consulta-comercios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultaComercios.component.html',
  styleUrls: ['./consultaComercios.component.css']
})
export class ConsultaComerciosComponent {
  constructor(private router: Router) {}

  readonly niveles = [
    { id: 'todos' as NivelComercio, label: 'Todos los niveles', icon: 'fa-layer-group' },
    { id: 'sub-afiliado' as NivelComercio, label: 'Sub Afiliado', icon: 'fa-user-tie' },
    { id: 'entidad' as NivelComercio, label: 'Entidad', icon: 'fa-building' },
    { id: 'sucursal' as NivelComercio, label: 'Sucursal', icon: 'fa-store' },
    { id: 'caja' as NivelComercio, label: 'Caja', icon: 'fa-cash-register' }
  ];

  filtros = {
    nivel: 'todos' as NivelComercio,
    nombre: '',
    rfc: '',
    correo: '',
    telefono: ''
  };

  comercios: Comercio[] = [
    { idComercio: 'COM-00012842', nivel: 'Sub Afiliado', jerarquia: 'Empresa Holding', nombreComercial: 'Sub Afiliado Norte', razonSocial: 'Sub Afiliado Norte SA de CV', rfc: 'SAN010101AA1', correo: 'holding@subnorte.com', telefono: '55 1000 0000', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012843', nivel: 'Entidad', jerarquia: 'Sub Afiliado Norte / Entidad 01', nombreComercial: 'Entidad Financiera México', razonSocial: 'Entidad Financiera México SA', rfc: 'EFM010101BB2', correo: 'entidad01@subnorte.com', telefono: '55 1000 0101', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012839', nivel: 'Entidad', jerarquia: 'Sub Afiliado Norte / Entidad 02', nombreComercial: 'Entidad Financiera Occidente', razonSocial: 'Entidad Financiera Occidente SA', rfc: 'EFO010101CC3', correo: 'entidad02@subnorte.com', telefono: '55 1000 0202', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012844', nivel: 'Sucursal', jerarquia: 'Entidad 01 / Sucursal 01', nombreComercial: 'Sucursal Toluca Centro', razonSocial: 'Sucursal Toluca Centro SA', rfc: 'STC010101DD4', correo: 'sucursal01.e1@subnorte.com', telefono: '55 1101 0001', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012840', nivel: 'Sucursal', jerarquia: 'Entidad 01 / Sucursal 02', nombreComercial: 'Sucursal Metepec', razonSocial: 'Sucursal Metepec SA', rfc: 'SME010101EE5', correo: 'sucursal02.e1@subnorte.com', telefono: '55 1101 0002', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012836', nivel: 'Sucursal', jerarquia: 'Entidad 01 / Sucursal 03', nombreComercial: 'Sucursal Zinacantepec', razonSocial: 'Sucursal Zinacantepec SA', rfc: 'SZI010101FF6', correo: 'sucursal03.e1@subnorte.com', telefono: '55 1101 0003', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012846', nivel: 'Sucursal', jerarquia: 'Entidad 02 / Sucursal 01', nombreComercial: 'Sucursal Guadalajara Centro', razonSocial: 'Sucursal Guadalajara Centro SA', rfc: 'SGC010101GG7', correo: 'sucursal01.e2@subnorte.com', telefono: '55 1102 0001', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012847', nivel: 'Sucursal', jerarquia: 'Entidad 02 / Sucursal 02', nombreComercial: 'Sucursal Zapopan', razonSocial: 'Sucursal Zapopan SA', rfc: 'SZA010101HH8', correo: 'sucursal02.e2@subnorte.com', telefono: '55 1102 0002', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012848', nivel: 'Sucursal', jerarquia: 'Entidad 02 / Sucursal 03', nombreComercial: 'Sucursal Tlaquepaque', razonSocial: 'Sucursal Tlaquepaque SA', rfc: 'STL010101II9', correo: 'sucursal03.e2@subnorte.com', telefono: '55 1102 0003', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012845', nivel: 'Caja', jerarquia: 'Entidad 01 / Sucursal 01 / Caja 01', nombreComercial: 'Caja 01 Toluca Centro', razonSocial: 'Caja 01 Toluca Centro SA', rfc: 'C1T010101JJ1', correo: 'caja01.s1e1@subnorte.com', telefono: '55 1201 0101', estatus: 'Activo', cajaPinRapido: true, password: 'Temp1#209901' },
    { idComercio: 'COM-00012841', nivel: 'Caja', jerarquia: 'Entidad 01 / Sucursal 01 / Caja 02', nombreComercial: 'Caja 02 Toluca Centro', razonSocial: 'Caja 02 Toluca Centro SA', rfc: 'C2T010101KK2', correo: 'caja02.s1e1@subnorte.com', telefono: '55 1201 0102', estatus: 'Activo', cajaPinRapido: true },
    { idComercio: 'COM-00012837', nivel: 'Caja', jerarquia: 'Entidad 01 / Sucursal 02 / Caja 01', nombreComercial: 'Caja 01 Metepec', razonSocial: 'Caja 01 Metepec SA', rfc: 'C1M010101LL3', correo: 'caja01.s2e1@subnorte.com', telefono: '55 1201 0201', estatus: 'Activo', cajaPinRapido: true, password: 'Caja2#445566' }
  ];

  resultados = [...this.comercios];
  paginaActual = 1;
  elementosPorPagina = 10;
  busquedaTabla = '';
  exportMenuAbierto = false;
  accionesAbiertas: string | null = null;
  modalConfirmacion: { tipo: 'inactivar' | 'baja'; comercio: Comercio } | null = null;
  modalPassword: Comercio | null = null;
  modalCambiarPassword: Comercio | null = null;
  nuevaPassword = '';
  confirmarPassword = '';
  mostrarPassword = false;
  mostrarNuevaPassword = false;
  mostrarConfirmarPassword = false;

  get resultadosFiltradosTabla(): Comercio[] {
    const termino = this.busquedaTabla.trim().toLowerCase();
    if (!termino) return this.resultados;

    return this.resultados.filter(comercio =>
      Object.values(comercio).some(valor => String(valor).toLowerCase().includes(termino))
    );
  }

  get comerciosPaginados(): Comercio[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.resultadosFiltradosTabla.slice(inicio, inicio + this.elementosPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.resultadosFiltradosTabla.length / this.elementosPorPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, index) => index + 1);
  }

  get resumen() {
    return {
      comercios: this.resultados.length,
      entidades: this.resultados.filter(item => item.nivel === 'Entidad').length,
      sucursales: this.resultados.filter(item => item.nivel === 'Sucursal').length,
      cajas: this.resultados.filter(item => item.nivel === 'Caja').length
    };
  }

  seleccionarNivel(nivel: NivelComercio): void {
    this.filtros.nivel = nivel;
    this.buscar();
  }

  buscar(): void {
    const normalizar = (valor: string) => valor.trim().toLowerCase();
    const nivel = this.filtros.nivel;
    const nombre = normalizar(this.filtros.nombre);
    const rfc = normalizar(this.filtros.rfc);
    const correo = normalizar(this.filtros.correo);
    const telefono = normalizar(this.filtros.telefono);

    this.resultados = this.comercios.filter(comercio => {
      const coincideNivel = nivel === 'todos' || this.normalizarNivel(comercio.nivel) === nivel;
      const coincideNombre = !nombre || comercio.nombreComercial.toLowerCase().includes(nombre) || comercio.razonSocial.toLowerCase().includes(nombre);
      const coincideRfc = !rfc || comercio.rfc.toLowerCase().includes(rfc);
      const coincideCorreo = !correo || comercio.correo.toLowerCase().includes(correo);
      const coincideTelefono = !telefono || comercio.telefono.toLowerCase().includes(telefono);

      return coincideNivel && coincideNombre && coincideRfc && coincideCorreo && coincideTelefono;
    });

    this.paginaActual = 1;
    this.accionesAbiertas = null;
  }

  limpiar(): void {
    this.filtros = { nivel: 'todos', nombre: '', rfc: '', correo: '', telefono: '' };
    this.busquedaTabla = '';
    this.resultados = [...this.comercios];
    this.paginaActual = 1;
  }

  cambiarPagina(pagina: number): void {
    this.paginaActual = Math.min(Math.max(pagina, 1), this.totalPaginas);
  }

  toggleAcciones(idComercio: string): void {
    this.accionesAbiertas = this.accionesAbiertas === idComercio ? null : idComercio;
  }

  ejecutarAccion(accion: 'editar' | 'inactivar' | 'baja' | 'revision-mesa-digital' | 'password' | 'registrar-informacion', comercio: Comercio): void {
    this.accionesAbiertas = null;

    if (accion === 'registrar-informacion') {
      this.router.navigate(['/registro_cliente'], {
        queryParams: {
          id: comercio.idComercio,
          nivel: comercio.nivel,
          nombre: comercio.nombreComercial,
          rfc: comercio.rfc,
          correo: comercio.correo,
          telefono: comercio.telefono,
          paquete: 'empresa-holding',
          entidades: 2,
          sucursales: 3,
          cajas: 2,
          selectedNode: this.nodoRegistroPorComercio(comercio)
        }
      });
      return;
    }

    if (accion === 'editar') {
      console.log('Consultar/editar comercio:', comercio);
      return;
    }

    if (accion === 'revision-mesa-digital') {
      this.router.navigate(['/revision_mesa_digital']);
      return;
    }

    if (accion === 'password') {
      this.modalPassword = comercio;
      this.mostrarPassword = false;
      return;
    }

    this.modalConfirmacion = { tipo: accion, comercio };
  }

  confirmarOperacion(): void {
    if (!this.modalConfirmacion) return;

    const { tipo, comercio } = this.modalConfirmacion;
    comercio.estatus = tipo === 'inactivar' ? 'Inactivo' : 'Baja definitiva';
    this.modalConfirmacion = null;
  }

  abrirCambioPassword(): void {
    if (!this.modalPassword) return;

    this.modalCambiarPassword = this.modalPassword;
    this.modalPassword = null;
    this.nuevaPassword = '';
    this.confirmarPassword = '';
    this.mostrarNuevaPassword = false;
    this.mostrarConfirmarPassword = false;
  }

  guardarPassword(): void {
    if (!this.modalCambiarPassword || !this.passwordValida || this.nuevaPassword !== this.confirmarPassword) return;

    this.modalCambiarPassword.password = this.nuevaPassword;
    this.modalCambiarPassword = null;
  }

  private nodoRegistroPorComercio(comercio: Comercio): string {
    if (comercio.nivel === 'Sub Afiliado') return 'sub-afiliado-1';

    const entidadMatch = comercio.jerarquia.match(/Entidad\s+0?(\d+)/i);
    const sucursalMatch = comercio.jerarquia.match(/Sucursal\s+0?(\d+)/i);
    const cajaMatch = comercio.jerarquia.match(/Caja\s+0?(\d+)/i);
    const entidad = entidadMatch ? Number(entidadMatch[1]) : comercio.idComercio === 'COM-00012839' ? 2 : 1;

    if (comercio.nivel === 'Entidad') return `entidad-${entidad}`;

    const sucursal = sucursalMatch ? Number(sucursalMatch[1]) : 1;
    if (comercio.nivel === 'Sucursal') return `entidad-${entidad}-sucursal-${sucursal}`;

    const caja = cajaMatch ? Number(cajaMatch[1]) : 1;
    return `entidad-${entidad}-sucursal-${sucursal}-caja-${caja}`;
  }

  get passwordValida(): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$@!%*?&]).{12,}$/.test(this.nuevaPassword);
  }

  puedeConsultarPassword(comercio: Comercio): boolean {
    return comercio.nivel === 'Caja' && !!comercio.cajaPinRapido;
  }

  exportarExcel(): void {
    const fecha = this.obtenerFechaArchivo();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`Consulta-Comercios-${fecha}`],
      this.encabezadosExportacion(),
      ...this.filasExportacion()
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    worksheet['!cols'] = this.encabezadosExportacion().map(() => ({ wch: 24 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consulta Comercios');
    XLSX.writeFile(workbook, `Consulta-Comercios-${fecha}.xlsx`);
    this.exportMenuAbierto = false;
  }

  exportarPDF(): void {
    const fecha = this.obtenerFechaArchivo();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text(`Consulta de Comercios - ${fecha}`, 148, 20, { align: 'center' });

    autoTable(doc, {
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [199, 146, 75], textColor: [20, 20, 20], fontStyle: 'bold' },
      head: [this.encabezadosExportacion()],
      body: this.filasExportacion()
    });

    doc.save(`Consulta-Comercios-${fecha}.pdf`);
    this.exportMenuAbierto = false;
  }

  normalizarNivel(nivel: Comercio['nivel']): NivelComercio {
    return nivel.toLowerCase().replace(' ', '-') as NivelComercio;
  }

  private encabezadosExportacion(): string[] {
    return ['Id Comercio', 'Nivel', 'Nombre Comercial', 'Razón Social', 'RFC', 'Correo Electrónico', 'Teléfono', 'Estatus'];
  }

  private filasExportacion(): string[][] {
    return this.resultadosFiltradosTabla.map(comercio => [
      comercio.idComercio,
      comercio.nivel,
      comercio.nombreComercial,
      comercio.razonSocial,
      comercio.rfc,
      comercio.correo,
      comercio.telefono,
      comercio.estatus
    ]);
  }

  private obtenerFechaArchivo(): string {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
