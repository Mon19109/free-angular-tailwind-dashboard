import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { OperacionesEmisionService } from '../../services/operacionesemision.service';
import { SaldosService } from '../../services/saldos.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize, Observable, Subscription } from 'rxjs';
import { ProcessingOverlayComponent } from '../../shared/components/processing-overlay/processing-overlay.component';
import { SelectComponent } from '../../shared/components/form/select/select.component';

@Component({
  selector: 'app-informacion-cuenta',
  standalone: true,
  imports: [CommonModule, SelectComponent, ProcessingOverlayComponent],
  templateUrl: './informacionCuenta.component.html',
  styleUrls: ['./informacionCuenta.component.css']
})
export class InformacionCuentaComponent implements OnInit {
  private operacionesEmisionService = inject(OperacionesEmisionService);
  private saldosService = inject(SaldosService);

  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly cargando = signal(false);
  private consultasPendientes = 0;
  private readonly destroyRef = inject(DestroyRef);
  private entidadesRequest?: Subscription;
  private infoRequest?: Subscription;
  errorCarga = '';

  private conCarga<T>(request: Observable<T>): Observable<T> {
    return defer(() => {
      this.consultasPendientes += 1;
      this.cargando.set(true);
      return request.pipe(finalize(() => {
        this.consultasPendientes -= 1;
        this.cargando.set(this.consultasPendientes > 0);
        this.changeDetector.markForCheck();
      }));
    }).pipe(takeUntilDestroyed(this.destroyRef));
  }

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

  get cuentasOptions() {
    return this.cuentas.map(cuenta => ({
      label: this.obtenerTextoCuenta(cuenta),
      value: this.obtenerValorCuenta(cuenta)
    }));
  }

  get entidadesOptions() {
    return this.entidades.map(entidad => ({
      label: this.obtenerTextoEntidad(entidad),
      value: this.obtenerValorEntidad(entidad)
    }));
  }

  seleccionarCuenta(cuenta: string): void {
    this.onCuentaChange({ target: { value: cuenta } } as unknown as Event);
  }

  seleccionarEntidad(entidad: string): void {
    this.onEntidadChange({ target: { value: entidad } } as unknown as Event);
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.conCarga(this.operacionesEmisionService.obtenerConcentratorAccounts()).subscribe({
      next: (resp) => {
        this.cuentas = this.normalizarLista(resp, [
          'data',
          'accounts',
          'concentratorAccounts',
          'accountList'
        ]);

        const cuentaAdquirencia = this.cuentas.find(
          cuenta => this.esAdquirente(cuenta)
        );
        const valorCuentaAdquirencia = this.obtenerValorCuenta(cuentaAdquirencia);

        if (valorCuentaAdquirencia) {
          this.cuentaSeleccionada = valorCuentaAdquirencia;
          this.seleccionarCuenta(valorCuentaAdquirencia);
        }
      },
      error: () => { this.errorCarga = 'No se pudieron cargar las cuentas. Intenta de nuevo.'; }
    });

  }

  onCuentaChange(event: Event): void {
    const cuenta = (event.target as HTMLSelectElement).value;
    this.cuentaSeleccionada = cuenta;
    this.entidadSeleccionada = '';
    this.entidadesRequest?.unsubscribe();
    this.infoRequest?.unsubscribe();
    this.entidades = [];
    this.errorCarga = '';
    this.limpiarInfoCuenta();

    const cuentaSeleccionada = this.cuentas.find(
      item => this.obtenerValorCuenta(item) === cuenta
    );

    if (!cuentaSeleccionada) {
      this.limpiarInfoCuenta();
      return;
    }

    this.infoCuenta.titular = this.obtenerTextoCuenta(cuentaSeleccionada);

    // Adquirente tiene información propia, incluso cuando no tiene entidades hijas.
    if (this.esAdquirente(cuentaSeleccionada)) {
      this.cargarInfoCuenta(cuenta);
    }

    this.entidadesRequest = this.conCarga(
      this.operacionesEmisionService.obtenerEntidades(cuenta)
    ).subscribe({
      next: (resp) => {
        this.entidades = this.normalizarLista(resp, [
          'data',
          'entities',
          'entityLevels',
          'items'
        ]);
      },
      error: () => { this.errorCarga = 'No se pudieron cargar las entidades. Vuelve a seleccionar la cuenta.'; }
    });
  }

  onEntidadChange(event: Event): void {
    const entidad = (event.target as HTMLSelectElement).value;
    this.entidadSeleccionada = entidad;
    this.infoRequest?.unsubscribe();
    this.errorCarga = '';
    this.limpiarInfoCuenta();

    const entidadEncontrada = this.entidades.find(
      item => this.obtenerValorEntidad(item) === entidad
    );

    this.infoCuenta.titular =
      entidadEncontrada?.bussinesName ||
      entidadEncontrada?.businessName ||
      entidadEncontrada?.name ||
      this.infoCuenta.titular ||
      'ND';

    this.cargarInfoCuenta(entidad);
  }

  cargarInfoCuenta(fatherId: string): void {
    if (!fatherId) {
      return;
    }

    this.infoRequest = this.conCarga(this.saldosService.getSaldo(fatherId)).subscribe({
      next: (resp) => {
        const balanceData = resp?.onsignaEntity || resp?.data || resp;

        this.infoCuenta = {
          clabe: balanceData?.virtualAccount || 'ND',
          saldo: Number(balanceData?.balance ?? balanceData?.saldo ?? 0),
          banco: 'STP',
          titular: balanceData?.name || this.infoCuenta.titular || 'ND',
          afiliacion: balanceData?.affiliationId || balanceData?.affiliation || 'ND'
        };
      },
      error: () => { this.errorCarga = 'No se pudo cargar la información de la entidad. Intenta de nuevo.'; }
    });
  }

  private esAdquirente(cuenta: any): boolean {
    const modelo = cuenta?.idbusinessModel ?? cuenta?.idBusinessModel;
    return Number(modelo) === 2 || /adquir/i.test(this.obtenerTextoCuenta(cuenta));
  }

  obtenerValorCuenta(cuenta: any): string {
    const valor = cuenta?.idSirio || cuenta?.sirioId || cuenta?.id || cuenta?.bundle;
    return valor === null || valor === undefined ? '' : String(valor);
  }

  obtenerTextoCuenta(cuenta: any): string {
    return cuenta?.name || cuenta?.nombre || cuenta?.businessName || cuenta?.bussinesName || this.obtenerValorCuenta(cuenta);
  }

  obtenerValorEntidad(entidad: any): string {
    const valor = entidad?.bundle || entidad?.idSirio || entidad?.sirioId || entidad?.id;
    return valor === null || valor === undefined ? '' : String(valor);
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

  private limpiarInfoCuenta(): void {
    this.infoCuenta = {
      clabe: 'ND',
      saldo: 0,
      banco: 'STP',
      titular: 'ND',
      afiliacion: 'ND'
    };
  }
}
