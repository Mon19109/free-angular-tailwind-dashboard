import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface SipreladResultado {
  rfc: string;
  nombre: string;
  fechaRegistro: string;
  coincidenciaListas: string;
}

interface SipreladContexto {
  rfc: string;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class SipreladService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.SipreladServices}`;

  consultarResultadoPld(transactionId: string): Observable<SipreladResultado[]> {
    return this.http.post<unknown>(
      `${this.baseUrl}getPLDResult`,
      { transactionId },
      { headers: this.headers() }
    ).pipe(
      map(respuesta => this.normalizarResultados(respuesta))
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.obtenerToken()}`,
    });
  }

  private obtenerToken(): string {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session?.token) return String(session.token);
    } catch {
      // Usa llaves legacy abajo.
    }

    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }

  private normalizarResultados(respuesta: unknown): SipreladResultado[] {
    const contexto = this.extraerContexto(respuesta);
    const registros = this.extraerRegistros(respuesta)
      .filter(registro => !this.esRespuestaSinCoincidencias(registro));

    return registros.map(registro => ({
      rfc: this.valor(registro, ['rfc', 'RFC']) || contexto.rfc,
      nombre: this.valor(registro, ['nombre', 'name', 'Nombre', 'businessName', 'nameCommerce']) || contexto.nombre,
      fechaRegistro: this.valor(registro, ['fechaBusqueda', 'fechaRegistro', 'registerDate', 'dateTimeCreated', 'createdAt', 'Fecha de registro']),
      coincidenciaListas: this.coincidenciaDesdeRegistro(registro),
    })).filter(registro => Object.values(registro).some(Boolean));
  }

  private extraerRegistros(respuesta: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(respuesta)) return respuesta.filter(this.esRegistro);
    if (!respuesta || typeof respuesta !== 'object') return [];

    const data = respuesta as Record<string, unknown>;
    const pldResult = this.esRegistro(data['pldResult']) ? data['pldResult'] : null;
    if (pldResult && Array.isArray(pldResult['response'])) {
      return pldResult['response'].filter(this.esRegistro);
    }

    const posiblesListas = [
      data['data'],
      data['result'],
      data['results'],
      data['items'],
      data['pldResults'],
    ];

    for (const lista of posiblesListas) {
      if (Array.isArray(lista)) return lista.filter(this.esRegistro);
    }

    return this.esRegistro(data) ? [data] : [];
  }

  private extraerContexto(respuesta: unknown): SipreladContexto {
    if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
      return { rfc: '', nombre: '' };
    }

    const data = respuesta as Record<string, unknown>;
    const pldResult = this.esRegistro(data['pldResult']) ? data['pldResult'] : data;
    const nombrePersona = [
      this.valor(pldResult, ['name']),
      this.valor(pldResult, ['patSurname']),
      this.valor(pldResult, ['matSurname']),
    ].filter(Boolean).join(' ');

    return {
      rfc: this.valor(pldResult, ['rfc', 'RFC']),
      nombre: this.valor(pldResult, ['companyName']) || nombrePersona,
    };
  }

  private esRespuestaSinCoincidencias(registro: Record<string, unknown>): boolean {
    const logError = this.valor(registro, ['logError']);
    return this.normalizarTexto(logError).includes('NO SE ENCONTRARON COINCIDENCIAS');
  }

  private coincidenciaDesdeRegistro(registro: Record<string, unknown>): string {
    const coincidencia = this.valor(registro, ['coincidenciaListas', 'matchLists', 'coincidence', 'Coincidencia en Listas']);
    if (coincidencia) return coincidencia;

    return this.esRespuestaSinCoincidencias(registro) ? 'No' : 'Si';
  }

  private esRegistro(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private valor(registro: Record<string, unknown>, llaves: string[]): string {
    for (const llave of llaves) {
      const valor = registro[llave];
      if (valor !== undefined && valor !== null) return String(valor);
    }

    return '';
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }
}
