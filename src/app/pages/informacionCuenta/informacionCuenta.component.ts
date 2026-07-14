import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { SaldosService } from '../../services/saldos.service';

@Component({
  selector: 'app-informacion-cuenta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './informacionCuenta.component.html',
  styleUrls: ['./informacionCuenta.component.css']
})
export class InformacionCuentaComponent implements OnInit {
  private operacionesEmisionService = inject(OperacionesEmisionService);
  private saldosService = inject(SaldosService);

  cuentas: any[] = [];
  entidades: any[] = [];
  cuentaSeleccionada = '';
  entidadSeleccionada = '';

  infoCuenta = {
    clabe: 'ND',
    saldo: 0,
    banco: 'STP',
    titular: 'ND',
    afiliacion: 'ND'
  };

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.operacionesEmisionService.obtenerConcentratorAccounts().subscribe({
      next: (resp) => {
        this.cuentas = this.normalizarLista(resp, [
          'data',
          'accounts',
          'concentratorAccounts',
          'accountList'
        ]);
      },
      error: (error) => console.error('Error al cargar cuentas:', error)
    });

    this.operacionesEmisionService.obtenerCuentas().subscribe({
      next: (resp) => {
        this.entidades = this.normalizarLista(resp, [
          'data',
          'entities',
          'entityLevels',
          'items'
        ]);
      },
      error: (error) => console.error('Error al cargar entidades:', error)
    });

    this.infoCuenta.clabe = this.obtenerClabeSesion();
  }

  onCuentaChange(event: Event): void {
    const cuenta = (event.target as HTMLSelectElement).value;
    this.cuentaSeleccionada = cuenta;
    this.entidadSeleccionada = '';

    const cuentaSeleccionada = this.cuentas.find(
      item => this.obtenerValorCuenta(item) === cuenta
    );

    if (!cuentaSeleccionada) {
      this.limpiarInfoCuenta();
      return;
    }

    this.infoCuenta.titular = this.obtenerTextoCuenta(cuentaSeleccionada);

    if (cuentaSeleccionada.idbusinessModel === 2) {
      this.entidades = [];
      this.cargarInfoCuenta(cuenta);
      return;
    }

    this.operacionesEmisionService.obtenerEntidades(cuenta).subscribe({
      next: (resp) => {
        this.entidades = this.normalizarLista(resp, [
          'data',
          'entities',
          'entityLevels',
          'items'
        ]);
      },
      error: (error) => console.error('Error al cargar entidades:', error)
    });
  }

  onEntidadChange(event: Event): void {
    const entidad = (event.target as HTMLSelectElement).value;
    this.entidadSeleccionada = entidad;

    const entidadEncontrada = this.entidades.find(
      item => this.obtenerValorEntidad(item) === entidad
    );

    this.infoCuenta.titular =
      entidadEncontrada?.bussinesName ||
      entidadEncontrada?.name ||
      this.infoCuenta.titular ||
      'ND';

    this.cargarInfoCuenta(entidad);
  }

  cargarInfoCuenta(fatherId: string): void {
    if (!fatherId) {
      return;
    }

    this.saldosService.getSaldo(fatherId).subscribe({
      next: (resp) => {
        const balanceData = resp?.onsignaEntity || resp?.data || resp;

        this.infoCuenta = {
          clabe: balanceData?.clabeAccount || this.obtenerClabeSesion(),
          saldo: Number(balanceData?.balance ?? balanceData?.saldo ?? 0),
          banco: 'STP',
          titular: balanceData?.name || this.infoCuenta.titular || 'ND',
          afiliacion: balanceData?.affiliationId || balanceData?.affiliation || 'ND'
        };
      },
      error: (error) => console.error('Error al cargar información de cuenta:', error)
    });
  }

  obtenerValorCuenta(cuenta: any): string {
    return cuenta?.idSirio || cuenta?.sirioId || cuenta?.id || cuenta?.bundle || '';
  }

  obtenerTextoCuenta(cuenta: any): string {
    return cuenta?.name || cuenta?.nombre || cuenta?.businessName || cuenta?.bussinesName || this.obtenerValorCuenta(cuenta);
  }

  obtenerValorEntidad(entidad: any): string {
    return entidad?.bundle || entidad?.idSirio || entidad?.sirioId || entidad?.id || '';
  }

  obtenerTextoEntidad(entidad: any): string {
    const bundle = entidad?.bundle || this.obtenerValorEntidad(entidad);
    const name = entidad?.bussinesName || entidad?.businessName || entidad?.name || entidad?.nombre || '';

    return name ? `${bundle} - ${name}` : bundle;
  }

  private normalizarLista(response: any, keys: string[]): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    for (const key of keys) {
      if (Array.isArray(response?.[key])) {
        return response[key];
      }
    }

    return [];
  }

  private obtenerClabeSesion(): string {
    const rawSession = localStorage.getItem('auth_session');

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        return session?.spei || session?.clabeAccount || localStorage.getItem('spei') || 'ND';
      } catch {
        return localStorage.getItem('spei') || 'ND';
      }
    }

    return localStorage.getItem('spei') || 'ND';
  }

  private limpiarInfoCuenta(): void {
    this.infoCuenta = {
      clabe: this.obtenerClabeSesion(),
      saldo: 0,
      banco: 'STP',
      titular: 'ND',
      afiliacion: 'ND'
    };
  }
}
