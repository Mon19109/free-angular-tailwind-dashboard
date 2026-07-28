import { Component, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransaccionesAdquirenciaService, FiltrosTransaccion, Transaccion } from '../../services/transaccionesadquirencia.service';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
//import { AuthService, UserSessionData } from '../../services/auth.service';
//import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';

declare var bootbox: any;
declare var moment: any;

@Component({
  selector: 'app-transacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './transaccionesAdquirencia.component.html',
  styleUrls: ['./transaccionesAdquirencia.component.css']
})
export class TransaccionesAdquirenciaComponent implements OnInit, AfterViewInit {
  private transaccionesAdquirenciaService = inject(TransaccionesAdquirenciaService);
  
  // Variables de sesión (deben venir de AuthService)
  rolId = '2';
  contId = '1';
  entiId = '1';
  subAfSelect = '0';
  entidadSelect = '0';
  sucursalSelect = '0';
  cajaSelect = '0';
  baseUrl = '';
  urlTi = '';
  keyMaps = '';
  
  // Signals
  subafiliados = signal<any[]>([]);
  entidades = signal<any[]>([]);
  sucursales = signal<any[]>([]);
  cajas = signal<any[]>([]);
  operaciones = signal<any[]>([]);
  estadosTransaccion = signal<any[]>([]);
  transacciones = signal<Transaccion[]>([]);
  
  loading = signal<boolean>(false);
  showTable = signal<boolean>(false);
  errorMessage = signal<string>('');
  // Filtros
  filtros: FiltrosTransaccion = {
    subafiliado: '',
    entidad: '',
    sucursal: '',
    caja: '',
    operacion: '',
    monto: '',
    montoDesde: '',
    montoHasta: '',
    edoTransaccion: '',
    referencia: '',
    autorizacion: '',
    numTarjeta: '',
    bin: '',
    fechaInicio: '',
    fechaFin: ''
  };
  
  //user: UserSessionData | null = null;
  elementosPorPagina = 10;
  paginaActual = 1;
  busquedaTabla = '';
  exportMenuAbierto = false;
  
  @ViewChild('map') mapElement!: ElementRef;
  
  ngOnInit() {
    this.cargarDatosSesion();
    this.inicializarFechas();
    this.cargarCatalogos();
    this.cargarDependenciasIniciales();

  }
  
  ngAfterViewInit() {
  }

  private cargarDatosSesion() {
    this.rolId = localStorage.getItem('idRol') || this.rolId;
    this.contId = localStorage.getItem('idContext') || this.contId;
    this.entiId = localStorage.getItem('idEntity') || this.entiId;

    if (this.contId && this.contId !== '0') {
      this.subAfSelect = this.getOptionValue(this.contId, localStorage.getItem('nodeID') || undefined);
    }

    if (this.entiId && this.entiId !== '0') {
      this.entidadSelect = this.entiId;
    }
  }

  onFechaInicioChange(event: any) {
    this.filtros.fechaInicio = event.dateStr;
  }

  onFechaFinChange(event: any) {
    this.filtros.fechaFin = event.dateStr;
  }
  
  inicializarFechas() {
    const hoy = new Date();
    const mesLim = new Date();
    mesLim.setDate(mesLim.getDate() - 30);
    
    // Si no hay fechas seleccionadas, establecer fecha fin a hoy y fecha inicio a hace 30 días
    if (!this.filtros.fechaInicio) {
      this.filtros.fechaInicio = mesLim.toISOString().slice(0, 16);
    }
    if (!this.filtros.fechaFin) {
      this.filtros.fechaFin = hoy.toISOString().slice(0, 16);
    }
  }
  
  cargarCatalogos() {

  this.transaccionesAdquirenciaService.getOperaciones().subscribe({
    next: (res) => {
      console.log('OPERACIONES', res);

      this.operaciones.set(
        res.catTransactionTypes || []
      );
    },
    error: (err) => console.error(err)
  });

  this.transaccionesAdquirenciaService.getEstadosTransaccion().subscribe({
    next: (res) => {
      console.log('ESTADOS', res);

      this.estadosTransaccion.set(
        res.catResponseCodes || []
      );
    },
    error: (err) => console.error(err)
  });

}

  get nivelUsuario(): 'sub-afiliado' | 'entidad' | 'sucursal' | 'caja' {
    if (this.rolId === '3') return 'entidad';
    if (this.rolId === '4') return 'sucursal';
    if (this.rolId === '5' || this.rolId === '6') return 'caja';
    return 'sub-afiliado';
  }

  get mostrarFiltroEntidad(): boolean { return this.nivelUsuario === 'sub-afiliado'; }
  get mostrarFiltroSucursal(): boolean { return this.nivelUsuario === 'sub-afiliado' || this.nivelUsuario === 'entidad'; }
  get mostrarFiltroCaja(): boolean { return this.nivelUsuario !== 'caja'; }
  get resumenTransacciones() {
    const montos = this.transacciones().map(item => this.toNumber(item.amount));
    const total = montos.reduce((acc, monto) => acc + monto, 0);
    const transaccionMasAlta = montos.length ? Math.max(...montos) : 0;

    return {
      totalTransacciones: this.transacciones().length,
      montoTotal: total,
      promedio: montos.length ? total / montos.length : 0,
      transaccionMasAlta
    };
  }

  get transaccionesFiltradasTabla(): Transaccion[] {
    const termino = this.busquedaTabla.trim().toLowerCase();
    if (!termino) return this.transacciones();

    return this.transacciones().filter(transaccion =>
      [
        transaccion.idOperation,
        transaccion.authorizationDate,
        transaccion.entityName,
        transaccion.terminalName,
        transaccion.terminalUserName,
        transaccion.transactiontype,
        transaccion.status,
        transaccion.payEmail || transaccion.terminalUserName,
        transaccion.amount
      ].some(valor => String(valor ?? '').toLowerCase().includes(termino))
    );
  }

  get transaccionesPaginadas(): Transaccion[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.transaccionesFiltradasTabla.slice(inicio, inicio + this.elementosPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.transaccionesFiltradasTabla.length / this.elementosPorPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, index) => index + 1);
  }
  
  cargarDependenciasIniciales() {
    this.cargarSubafiliados();
    if (this.subAfSelect !== '0') {
      this.cargarEntidades(this.getSelectedId(this.subAfSelect));
    }
    if (this.entidadSelect !== '0') {
      this.cargarSucursales(this.getSelectedId(this.subAfSelect), this.getSelectedId(this.entidadSelect));
    }
    if (this.sucursalSelect !== '0') {
      this.cargarCajas(this.getSelectedId(this.sucursalSelect));
    }
  }
  
  onSubafiliadoChange() {
    if (this.filtros.subafiliado) {
      this.cargarEntidades(this.getSelectedId(this.filtros.subafiliado));
      this.filtros.entidad = '';
      this.filtros.sucursal = '';
      this.filtros.caja = '';
      this.entidades.set([]);
      this.sucursales.set([]);
      this.cajas.set([]);
    }
  }

  cargarSubafiliados() {
    const idContextSesion = localStorage.getItem('idContext') || this.contId;

    if (this.rolId !== '2' || (idContextSesion && idContextSesion !== '0')) {
      this.cargarSubafiliadoSesion();
      return;
    }

    this.transaccionesAdquirenciaService.getSubafiliados().subscribe({
      next: (res) => {
        if (res.contextResponse) {
          const subafiliadoList = res.contextResponse || res.contextResponse;
          this.subafiliados.set(subafiliadoList);
        } else {
          /*bootbox.alert({
            message: "El subafiliado.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        this.cargarSubafiliadoSesion();
        /*bootbox.alert({
          message: "Error al cargar entidades.",
          locale: 'mx'
        });*/
      }
    });
  }

  private cargarSubafiliadoSesion() {
    const idContext = Number(localStorage.getItem('idContext') || this.contId || 0);
    if (!idContext) {
      this.subafiliados.set([]);
      return;
    }

    this.transaccionesAdquirenciaService.getSubafiliadoById(idContext).subscribe({
      next: (res) => {
        const contextResponse = res.contextResponse;
        const subafiliadoList = Array.isArray(contextResponse)
          ? contextResponse
          : contextResponse
            ? [contextResponse]
            : [];

        this.subafiliados.set(subafiliadoList);

        if (subafiliadoList.length > 0) {
          const subafiliado = subafiliadoList[0];
          this.filtros.subafiliado = this.getOptionValue(
            subafiliado.idContext,
            subafiliado.nodeID || localStorage.getItem('nodeID') || undefined
          );
          this.cargarEntidades(subafiliado.idContext);
        }
      },
      error: (err) => console.error('Error al cargar subafiliado por sesión:', err)
    });
  }
  
  cargarEntidades(subafiliadoId: number) {
    this.transaccionesAdquirenciaService.getEntidades(subafiliadoId).subscribe({
      next: (res) => {
        const entidadesList = res.entitiesResponse || res.rows?.entitiesResponse || res.rows || [];
        if (Array.isArray(entidadesList) && entidadesList.length > 0) {
          this.entidades.set(entidadesList);
        } else {
          /*bootbox.alert({
            message: "El subafiliado seleccionado no tiene entidades relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        /*bootbox.alert({
          message: "Error al cargar entidades.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  onEntidadChange() {
    if (this.filtros.entidad && this.filtros.subafiliado) {
      this.cargarSucursales(
        this.getSelectedId(this.filtros.subafiliado),
        this.getSelectedId(this.filtros.entidad)
      );
      this.filtros.sucursal = '';
      this.filtros.caja = '';
      this.sucursales.set([]);
      this.cajas.set([]);
    }
  }
  
  cargarSucursales(subafiliadoId: number, entidadId: number) {
    this.transaccionesAdquirenciaService.getSucursales(subafiliadoId, entidadId).subscribe({
      next: (res) => {
        const sucursalesList = res.branchOfficeResponse || res.rows?.branchOfficeResponse || res.rows || [];
        if (Array.isArray(sucursalesList) && sucursalesList.length > 0) {
          this.sucursales.set(sucursalesList);
        } else {
          /*bootbox.alert({
            message: "La entidad seleccionada no tiene sucursales relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        /*bootbox.alert({
          message: "Error al cargar sucursales.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  onSucursalChange() {
    if (this.filtros.sucursal) {
      this.cargarCajas(this.getSelectedId(this.filtros.sucursal));
      this.filtros.caja = '';
      this.cajas.set([]);
    }
  }
  
  cargarCajas(idTerminal: number) {
    this.transaccionesAdquirenciaService.getCajas(idTerminal).subscribe({
      next: (res) => {
        const cajasList = res.collaborators || res.rows?.collaborators || res.rows || [];
        if (Array.isArray(cajasList) && cajasList.length > 0) {
          this.cajas.set(cajasList);
        } else {
          /*bootbox.alert({
            message: "La sucursal seleccionada no tiene cajas relacionadas.",
            locale: 'mx'
          });*/
        }
      },
      error: () => {
        /*bootbox.alert({
          message: "Error al cargar cajas.",
          locale: 'mx'
        });*/
      }
    });
  }
  
  validarFechas(): boolean {
    if (!this.filtros.fechaInicio || !this.filtros.fechaFin) {
      if (this.rolId === '2' || this.rolId === '3') {
        this.errorMessage.set('Para poder hacer una búsqueda necesitas seleccionar un rango de fecha.');
        return false;
      }
      return true;
    }
    
    const fechaInicio = new Date(this.filtros.fechaInicio);
    const fechaFin = new Date(this.filtros.fechaFin);
    const diffDays = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      this.errorMessage.set('Para poder hacer una búsqueda necesitas seleccionar un rango de fecha no mayor a 30 días.');
      return false;
    }
    
    this.errorMessage.set('');
    return true;
  }
  
  formatoMonto(value: string | number): string {
    if (!value) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num);
  }
  
  buscarTransacciones() {
    if (!this.validarFechas()) {
      return;
    }
    
    this.loading.set(true);
    this.showTable.set(false);
    
    this.transaccionesAdquirenciaService.buscarTransacciones(this.filtros).subscribe({
      next: (res) => {
        this.showTable.set(true);
        this.processTransactions(res);
        this.paginaActual = 1;
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error:', err);
        this.loading.set(false);
        /*bootbox.alert({
          message: 'Error al buscar transacciones',
          locale: 'mx'
        });*/
      }
    });
  }
  
  processTransactions(data: any) {
    if (data.rows?.content?.length > 0) {
      this.transacciones.set(data.rows.content);
    } else if (data.rows?.totalElements > 0) {
      this.transacciones.set(data.rows.content || []);
    } else {
      this.transacciones.set([]);
      /*bootbox.alert({
        message: data.rows?.error?.message || 'No se encontraron transacciones',
        locale: 'mx'
      });*/
    }
  }

  getOptionValue(id: string | number, nodeID?: string | number): string {
    return nodeID ? `${id}|${nodeID}` : String(id);
  }

  private getSelectedId(value?: string): number {
    return Number((value || '').split('|')[0] || 0);
  }
  
  limpiarFiltros() {
    this.filtros = {
      subafiliado: this.filtros.subafiliado || '',
      entidad: '',
      sucursal: '',
      caja: '',
      operacion: '',
      monto: '',
      montoDesde: '',
      montoHasta: '',
      edoTransaccion: '',
      referencia: '',
      autorizacion: '',
      numTarjeta: '',
      bin: '',
      fechaInicio: '',
      fechaFin: ''
    };
    this.inicializarFechas();
    this.busquedaTabla = '';
    this.paginaActual = 1;
    this.buscarTransacciones();
  }

  cambiarPagina(pagina: number): void {
    this.paginaActual = Math.min(Math.max(pagina, 1), this.totalPaginas);
  }

  formatCurrency(value: string | number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  formatearMontoFiltro(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');

    if (!digits) {
      this.filtros.monto = '';
      input.value = '';
      return;
    }

    const monto = Number(digits) / 100;
    const formatted = monto.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    this.filtros.monto = formatted;
    input.value = formatted;
  }

  tipoTransaccionClase(tipo?: string): string {
    const normalizado = this.normalizarTexto(tipo);
    if (normalizado.includes('venta')) return 'venta';
    if (normalizado.includes('pago')) return 'pago';
    if (normalizado.includes('devolucion')) return 'devolucion';
    if (normalizado.includes('transferencia')) return 'transferencia';
    return 'default';
  }

  tipoTransaccionIcono(tipo?: string): string {
    const clase = this.tipoTransaccionClase(tipo);
    const iconos: Record<string, string> = {
      venta: 'fa-cart-shopping',
      pago: 'fa-money-bill-wave',
      devolucion: 'fa-rotate-left',
      transferencia: 'fa-right-left',
      default: 'fa-receipt'
    };

    return iconos[clase];
  }

  esDevolucion(tipo?: string): boolean {
    return this.normalizarTexto(tipo).includes('devolucion');
  }

  exportarExcel(): void {
    const rows = this.transaccionesFiltradasTabla.map(transaccion => this.exportRow(transaccion));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');
    XLSX.writeFile(workbook, 'transacciones.xlsx');
    this.exportMenuAbierto = false;
  }

  exportarPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Consulta de Transacciones', 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['ID', 'Fecha / Hora', 'Sucursal', 'Caja', 'Tipo', 'Monto', 'Estatus', 'Usuario']],
      body: this.transaccionesFiltradasTabla.map(transaccion => [
        transaccion.idOperation,
        transaccion.authorizationDate,
        transaccion.terminalName,
        transaccion.terminalUserName,
        transaccion.transactiontype,
        this.formatCurrency(transaccion.amount),
        transaccion.status,
        transaccion.payEmail || transaccion.terminalUserName
      ])
    });
    doc.save('transacciones.pdf');
    this.exportMenuAbierto = false;
  }

  private exportRow(transaccion: Transaccion) {
    return {
      ID: transaccion.idOperation,
      'Fecha / Hora': transaccion.authorizationDate,
      Sucursal: transaccion.terminalName,
      Caja: transaccion.terminalUserName,
      'Tipo Transaccion': transaccion.transactiontype,
      Monto: this.toNumber(transaccion.amount),
      Estatus: transaccion.status,
      Usuario: transaccion.payEmail || transaccion.terminalUserName
    };
  }


  private toNumber(value: string | number): number {
    if (value === null || value === undefined || value === '') return 0;
    return typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, '')) || 0;
  }

  private normalizarTexto(value?: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  
  verTicket(transaccion: Transaccion) {
    const urlTicket = `${this.urlTi}${transaccion.authorizationRrcext}${transaccion.authorizationNumber}.pdf`;
    
    if (transaccion.status === 'APROBADA' || transaccion.status === 'Aprobada') {
      if (transaccion.paymentLink && transaccion.paymentLink !== 'ND') {
        window.open(transaccion.paymentLink, '_blank');
      } else {
        window.open(urlTicket, '_blank');
      }
    } else if (transaccion.status === 'DEVUELTA') {
      this.mostrarModalDevolucion(transaccion);
    }
  }
  
  mostrarModalDevolucion(transaccion: Transaccion) {
    const amountFormat = this.formatoMonto(transaccion.amount);
    const msg = this.generarHtmlDevolucion(transaccion, amountFormat);
    
    bootbox.dialog({
      title: "Ticket",
      message: msg,
      onEscape: true,
      backdrop: true,
      buttons: {
        confirm: {
          label: 'Imprimir',
          className: 'btn-primary',
          callback: () => this.imprimirTicket(msg)
        },
        cancel: {
          label: 'Ok',
          className: 'btn-success'
        }
      }
    });
  }
  
  generarHtmlDevolucion(transaccion: Transaccion, amountFormat: string): string {
    return `
      <div>
        <div style='font-family:Courier;'>
          <center>
            <br>
            <table border='0'>
              <tr>
                <td colspan='2' align='center' style='height:70px;background:#000; padding: 0px'>
                  <img src='https://portal-antares.kashplataforma.com/public/assets/img/logo_kashpay_sobra.png' height='50' align='center'>
                </td>
              </tr>
              <tr>
                <td colspan='2' align='center'>
                  <font style='font-size:9px;'>${transaccion.entityName} &nbsp;</font>
                </td>
              </tr>
              <tr style='font-size:9px;'>
                <td>FECHA:</td>
                <td align='right'>${transaccion.authorizationDate}</td>
              </tr>
              <tr><td>&nbsp;</td></tr>
              <tr><td>&nbsp;</td></tr>
            </table>
            <table width=248 border='0' cellspacing='0' cellpadding='0'>
              <tr style='font-size:11px;'>
                <td colspan='3' align='center' style='font-weight:bold'><center>DEVOLUCION</center></td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=2>NUMERO DE TARJETA/CTA</td>
                <td align='right' style='font-weight:bold'>XXXX-XXXX-XXXX-${transaccion.card}</td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=2 style='font-weight:bold'>IMPORTE</td>
                <td align='right'>${amountFormat}</td>
              </tr>
              <tr style='font-size:9px;'>
                <td colspan=3 style='font-weight:bold'>APROBACION No :${transaccion.authorizationRrcext}</td>
              </tr>
            </table>
          </center>
        </div>
      </div>
    `;
  }
  
  mostrarTicketConMapa(transaccion: Transaccion) {
    const amountFormat = this.formatoMonto(transaccion.amount);
    const cordenadas = `${transaccion.latitude},${transaccion.longitude}`;
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${cordenadas}&zoom=15&size=600x300&maptype=roadmap&markers=color:red|${cordenadas}&key=${this.keyMaps}`;
    
    const msg = `
      <div>
        <div>
          <table border='0' style='width: 100%;'>
            <tr>
              <td colspan='3' align='center' style='height:70px;background:#333f50; padding: 0px'>
                <img src='https://kashplataforma.com.mx/adquirencia2/public/assets/img/logo_kashpay_azul.png' height='50' align='center'>
              </td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan='3' align='center' style='font-weight:bold'>${transaccion.entityName}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>FECHA:</td>
              <td style='font-weight:bold'>${transaccion.authorizationDate}</td>
            </tr>
            <tr style='font-size:14px;'>
              <td colspan='3' align='center' style='font-weight:bold'><center>VENTA</center></td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>NUMERO DE TARJETA/CTA</td>
              <td style='font-weight:bold'>${transaccion.card}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2 style='font-weight:bold'>IMPORTE</td>
              <td style='font-weight:bold'>${amountFormat}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2 >APROBACION</td>
              <td style='font-weight:bold'>${transaccion.authorizationNumber}</td>
            </tr>
            <tr style='font-size:12px;'>
              <td colspan=2>FOLIO</td>
              <td style='font-weight:bold'>${transaccion.authorizationRrcext}</td>
            </tr>
            <tr>
              <td colspan=3>
                <img style='width:100%;' src='${imageUrl}'>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
    
    bootbox.dialog({
      title: "Ticket",
      message: msg,
      onEscape: true,
      backdrop: true,
      buttons: {
        confirm: {
          label: 'Imprimir',
          className: 'btn-primary',
          callback: () => this.imprimirTicket(msg)
        },
        cancel: {
          label: 'Ok',
          className: 'btn-success'
        }
      }
    });
  }
  
  imprimirTicket(html: string) {
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(html);
    printWindow?.document.write('</body></html>');
    printWindow?.print();
  }
  
  getComisiones(transaccion: Transaccion, tipo: number): number {
    const sirio = transaccion.operationSirio?.acquiringOperation;
    if (!sirio) return 0;
    
    switch(this.rolId) {
      case '2': return 0;
      case '3': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0);
      case '4': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0) + (sirio.transactionID || 0);
      case '5': return (sirio.transactionType || 0) + (sirio.transactionSubType || 0) + (sirio.transactionID || 0) + (sirio.timestamp || 0);
      case '6': return sirio.settleAmount || 0;
      default: return 0;
    }
  }
  
  getIVA(transaccion: Transaccion): number {
    return transaccion.operationSirio?.acquiringOperation?.systemSource || 0;
  }
  
  puedeAclarar(transaccion: Transaccion): boolean {
    return transaccion.status === 'APROBADA' && 
           transaccion.transactiontype === 'VENTA' &&
           (this.rolId === '2' || this.rolId === '3' || this.contId === '83' || this.contId === '134' || this.entiId === 'SUB981645');
  }
  
  maskCard(card: string): string {
    if (!card) return '';
    const last4 = card.slice(-4);
    return `XXXX-XXXX-XXXX-${last4}`;
  }
}
