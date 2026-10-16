import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, defer, finalize, map, shareReplay } from 'rxjs';
import { environment } from '../environments/environments';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

// Solo transporte público. Los servicios existentes conservan sus normalizadores.
@Injectable({ providedIn: 'root' })
export class PreregistroCatalogosHttpService {
  private readonly http = inject(HttpClient);
  private readonly pendientes = new Map<string, Observable<any>>();

  get<T = unknown>(url: string, params = new HttpParams()): Observable<T> {
    const key = `${url}?${params.toString()}`;
    const pendiente = this.pendientes.get(key);
    if (pendiente) return pendiente;
    const request = defer(() => this.http.get<T>(url, {
      params, context: new HttpContext().set(SKIP_AUTH_TOKEN, true),
    })).pipe(
      map(response => {
        if (!response || typeof response !== 'object' || ('success' in response && response.success === false)) {
          throw new Error('No fue posible consultar el catálogo de prerregistro.');
        }
        return this.adaptarReferencias(url, response) as T;
      }),
      finalize(() => this.pendientes.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.pendientes.set(key, request);
    return request;
  }

  private adaptarReferencias(url: string, response: any): unknown {
    // Compatibilidad de despliegue: el BFF anterior aún puede devolver los IDs.
    if (!Object.hasOwn(response, 'referencias')) return response;
    const referencias: unknown = response.referencias;
    const urls = environment.preregistroBff;
    const items = url === urls.actividadesUrl ? response.catActividadResponse
      : url === urls.institucionesUrl ? response.institutionResponse?.institutions : response.data;
    if (!Array.isArray(items) || !Array.isArray(referencias) || items.length !== referencias.length
      || referencias.some(ref => !Number.isSafeInteger(ref) || ref < 2 ** 48 || ref >= 2 ** 49)) {
      throw new Error('Las referencias del catálogo no son válidas.');
    }
    if (url === urls.actividadesUrl) return { catActividadResponse: items.map((item, i) => ({ actividad: item.actividad, idcat_actividades: referencias[i] })) };
    if (url === urls.tiposComercioUrl) return { data: items.map((item, i) => ({ name: item.name, id: referencias[i] })) };
    if (url === urls.regimenesFiscalesUrl) return { data: items.map((item, i) => ({ descripcion: item.descripcion, referencia: referencias[i] })) };
    if (url.startsWith(urls.localidadesUrl + '/')) return { data: items.map((item, i) => ({
      colonia: item.colonia, municipio: item.municipio, estado: item.estado, idLocalidad: String(referencias[i]),
    })) };
    if (url === urls.institucionesUrl) return { institutionResponse: { institutions: items.map((item, i) => ({ name: item.name, key: referencias[i] })) } };
    throw new Error('Catálogo de prerregistro desconocido.');
  }

}
