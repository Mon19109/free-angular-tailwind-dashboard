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
    { idComercio: 'COM-00012845', nivel: 'Caja', jerarquia: 'Sucursal Centro / Caja 1', nombreComercial: 'Tienda Del Centro', razonSocial: 'Tienda Del Centro SA de CV', rfc: 'TDC980101AB1', correo: 'tienda.centro@correo.com', telefono: '55 1234 5678', estatus: 'Activo', cajaPinRapido: true, password: 'Temp1#209901' },
    { idComercio: 'COM-00012844', nivel: 'Sucursal', jerarquia: 'Sucursal Norte', nombreComercial: 'Super Norte', razonSocial: 'Super Norte SA', rfc: 'SNO850203CD4', correo: 'contacto@supernorte.com', telefono: '81 2245 6789', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012843', nivel: 'Entidad', jerarquia: 'Entidad Monterrey', nombreComercial: 'Comercial Monterrey SA', razonSocial: 'Comercial Monterrey SA', rfc: 'CME850122EF6', correo: 'info@comercialmty.com', telefono: '81 8765 4321', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012842', nivel: 'Sub Afiliado', jerarquia: 'Sub Afiliado Premium', nombreComercial: 'Premium Stores', razonSocial: 'Premium Stores SA de CV', rfc: 'PST012305GH7', correo: 'ventas@premiumstores.com', telefono: '33 1122 3344', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012841', nivel: 'Caja', jerarquia: 'Sucursal Sur / Caja 2', nombreComercial: 'Abarrotes La Esquina', razonSocial: 'Abarrotes La Esquina SA', rfc: 'ALE920415IJ8', correo: 'esquina@correo.com', telefono: '55 3344 5566', estatus: 'Inactivo', cajaPinRapido: false },
    { idComercio: 'COM-00012840', nivel: 'Sucursal', jerarquia: 'Sucursal Centro', nombreComercial: 'Farmacia Central', razonSocial: 'Farmacia Central SA', rfc: 'FCE890630KL9', correo: 'contacto@farmaciacentral.com', telefono: '55 6677 8899', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012839', nivel: 'Entidad', jerarquia: 'Entidad Guadalajara', nombreComercial: 'Distribuidora del Bajio', razonSocial: 'Distribuidora del Bajio SA', rfc: 'DBJ800303MN1', correo: 'ventas@distrobajio.com', telefono: '33 9900 7766', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012838', nivel: 'Sub Afiliado', jerarquia: 'Sub Afiliado Empresarial', nombreComercial: 'Empresarial Grupo', razonSocial: 'Empresarial Grupo SA', rfc: 'EMP930712OP2', correo: 'info@empresarialgrupo.com', telefono: '55 4433 2211', estatus: 'Activo', tieneInferiores: true },
    { idComercio: 'COM-00012837', nivel: 'Caja', jerarquia: 'Sucursal Norte / Caja 3', nombreComercial: 'Mini Super Express', razonSocial: 'Mini Super Express SA', rfc: 'MSE940611QR3', correo: 'cajero2@minisuper.com', telefono: '81 2233 4455', estatus: 'Activo', cajaPinRapido: true, password: 'Caja2#445566' },
    { idComercio: 'COM-00012836', nivel: 'Sucursal', jerarquia: 'Sucursal Poniente', nombreComercial: 'Ferreteria del Poniente', razonSocial: 'Ferreteria del Poniente SA', rfc: 'FPO960221ST4', correo: 'ventas@ferreteriapte.com', telefono: '55 7788 9900', estatus: 'Activo', tieneInferiores: true }
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

  ejecutarAccion(accion: 'editar' | 'inactivar' | 'baja' | 'revision-mesa-digital' | 'password', comercio: Comercio): void {
    this.accionesAbiertas = null;

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
