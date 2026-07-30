import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environments';

export interface CodigoPostalLocalizacion {
  idLocalidad?: string;
  codPostal?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
  locationID?: string;
  postalCode?: string;
  district?: string;
  location?: string;
  municipality?: string;
  federativeEntity?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class LocalidadesService {
  private readonly http = inject(HttpClient);
  private readonly bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc';
  private apiUrl = environment.api.kashpay;

  obtenerPorCodigoPostal(codigoPostal: string): Observable<CodigoPostalLocalizacion[]> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.bearerToken}`
    });

    return this.http.get<unknown>(
      `${this.apiUrl}api/v1/localidades/${codigoPostal}`,
      { headers }
    ).pipe(
      map(response => this.extraerLocalidades(response))
    );
  }

  private extraerLocalidades(response: unknown): CodigoPostalLocalizacion[] {
    if (Array.isArray(response)) return response as CodigoPostalLocalizacion[];
    if (!response || typeof response !== 'object') return [];

    const body = response as Record<string, unknown>;
    const possibleLists = [
      body['data'],
      body['rows'],
      body['localidades'],
      body['response'],
      body['result'],
      body['items'],
    ];

    const list = possibleLists.find(Array.isArray);
    if (Array.isArray(list)) return list as CodigoPostalLocalizacion[];

    for (const value of possibleLists) {
      const nestedList = this.extraerLocalidades(value);
      if (nestedList.length) return nestedList;
    }

    const indexedValues = Object.keys(body)
      .filter(key => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map(key => body[key])
      .filter((value): value is CodigoPostalLocalizacion => !!value && typeof value === 'object');

    if (indexedValues.length) return indexedValues;

    for (const value of Object.values(body)) {
      const nestedList = this.extraerLocalidades(value);
      if (nestedList.length) return nestedList;
    }

    const looksLikeLocalidad = 'idLocalidad' in body || 'colonia' in body || 'municipio' in body;
    return looksLikeLocalidad ? [body as CodigoPostalLocalizacion] : [];
  }
}
