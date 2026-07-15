import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstadoCuentaService } from '../../services/estado-cuenta.service';

@Component({
  selector: 'app-estado-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estadoCuenta.component.html',
  styleUrls: ['./estadoCuenta.component.css']
})
export class EstadoCuentaComponent implements OnInit {
  private estadoCuentaService = inject(EstadoCuentaService);

  cuentas: any[] = [];
  periodos: string[] = [];
  cuentaSeleccionada = '';
  periodoSeleccionado = '';
  clabe = '';
  mensaje = '';
  cargando = false;

  ngOnInit(): void {
    this.periodos = this.generarPeriodos();
    this.periodoSeleccionado = this.periodos[0] || '';
    this.cargarCuentas();
  }

  cargarCuentas(): void {
    this.estadoCuentaService.obtenerCuentas().subscribe({
      next: (resp: any) => {
        this.cuentas = this.normalizarLista(resp, [
          'data',
          'accounts',
          'concentratorAccounts',
          'accountList'
        ]).filter(cuenta => this.debeMostrarCuenta(cuenta));
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
        this.mensaje = 'No fue posible cargar las cuentas.';
      }
    });
  }

  onCuentaChange(): void {
    this.clabe = '';

    if (!this.cuentaSeleccionada) {
      return;
    }

    this.estadoCuentaService.obtenerSaldo(this.cuentaSeleccionada).subscribe({
      next: (resp: any) => {
        const rows = resp?.rows || resp?.onsignaEntity || resp?.data || resp;
        this.clabe = rows?.clabeAccount || rows?.virtualAccount || '';
      },
      error: (error) => {
        console.error('Error al obtener saldo:', error);
        this.mensaje = 'No fue posible obtener la CLABE de la cuenta.';
      }
    });
  }

  descargarPDF(): void {
    this.generarReporte('PDF');
  }

  descargarExcel(): void {
    this.generarReporte('EXCEL');
  }

  generarReporte(tipo: 'PDF' | 'EXCEL'): void {
    this.mensaje = '';

    if (!this.cuentaSeleccionada || !this.periodoSeleccionado) {
      this.mensaje = 'Selecciona una cuenta y un periodo.';
      return;
    }

    const url = this.estadoCuentaService.construirUrlDescarga({
      tipo,
      periodo: this.periodoSeleccionado,
      cuenta: this.cuentaSeleccionada,
      clabe: this.clabe
    });

    this.descargarEnSegundoPlano(url);
  }

  obtenerValorCuenta(cuenta: any): string {
    return cuenta?.idSirio || cuenta?.sirioId || cuenta?.id || cuenta?.bundle || '';
  }

  obtenerTextoCuenta(cuenta: any): string {
    return cuenta?.name || cuenta?.nombre || cuenta?.businessName || cuenta?.bussinesName || this.obtenerValorCuenta(cuenta);
  }

  private generarPeriodos(): string[] {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];
    const fecha = new Date();
    const anioActual = fecha.getFullYear();
    const mesActual = fecha.getMonth();
    const periodos: string[] = [];

    for (let anio = anioActual; anio >= anioActual - 10; anio--) {
      const ultimoMes = anio === anioActual ? mesActual : 11;

      for (let mes = 0; mes <= ultimoMes; mes++) {
        periodos.push(`${anio} ${meses[mes]}`);
      }
    }

    return periodos;
  }

  private debeMostrarCuenta(cuenta: any): boolean {
    const idPerfil = Number(localStorage.getItem('idPerfil') || 0);

    if (idPerfil === 5) {
      return true;
    }

    return this.obtenerTextoCuenta(cuenta) !== 'Cuenta Reserva';
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    let current = response;

    for (const key of keys) {
      current = current?.[key];

      if (Array.isArray(current)) {
        return current;
      }
    }

    if (current && typeof current === 'object') {
      return [current];
    }

    return [];
  }

  private descargarEnSegundoPlano(url: string): void {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    window.setTimeout(() => {
      iframe.remove();
    }, 30000);
  }
}
