// geolocation.service.ts
import { Injectable } from '@angular/core';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  getCurrentLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {

      if (!navigator.geolocation) {
        reject('La geolocalización no es soportada por este navegador.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject('El usuario denegó el permiso de ubicación.');
              break;
            case error.POSITION_UNAVAILABLE:
              reject('La ubicación no está disponible.');
              break;
            case error.TIMEOUT:
              reject('Tiempo de espera agotado.');
              break;
            default:
              reject('Error desconocido al obtener ubicación.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }
}