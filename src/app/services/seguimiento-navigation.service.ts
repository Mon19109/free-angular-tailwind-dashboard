import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, defer, firstValueFrom, from, map, shareReplay, switchMap, throwError } from 'rxjs';
import { SKIP_AUTH_TOKEN } from './auth-token.interceptor';

export interface SeguimientoNavigationCoordinator {
  withNextSequence<T>(operation: (sequence: number) => Promise<T>): Promise<T>;
  withLock<T>(operation: () => Promise<T>): Promise<T>;
}

const LOCK_NAME = 'seguimiento-navigation-sequence-v1';
const DATABASE_NAME = 'seguimiento-navigation';
const DATABASE_VERSION = 1;
const STORE_NAME = 'state';
const SEQUENCE_KEY = 'navigationSequence';

class BrowserSeguimientoNavigationCoordinator implements SeguimientoNavigationCoordinator {
  withNextSequence<T>(operation: (sequence: number) => Promise<T>): Promise<T> {
    return this.withLock<T>(async () => await operation(await this.incrementSequence()));
  }

  withLock<T>(operation: () => Promise<T>): Promise<T> {
    const locks = globalThis.navigator?.locks;
    if (!locks) {
      return Promise.reject(new Error('Este navegador no permite coordinar de forma segura las pestañas de seguimiento.'));
    }
    return new Promise<T>((resolve, reject) => {
      void locks.request(LOCK_NAME, { mode: 'exclusive' }, async () => {
        try {
          resolve(await operation());
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });
  }

  private async incrementSequence(): Promise<number> {
    if (!globalThis.indexedDB) {
      throw new Error('No fue posible guardar la secuencia de navegación de forma persistente.');
    }
    const database = await this.openDatabase();
    try {
      return await new Promise<number>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const read = store.get(SEQUENCE_KEY);
        let sequence: number | undefined;

        read.onsuccess = () => {
          const previous = read.result;
          if (previous !== undefined && (!Number.isSafeInteger(previous) || previous < 0)) {
            transaction.abort();
            reject(new Error('La secuencia de navegación persistida no es válida.'));
            return;
          }
          sequence = (previous ?? 0) + 1;
          if (!Number.isSafeInteger(sequence)) {
            transaction.abort();
            reject(new Error('Se agotó la secuencia de navegación disponible.'));
            return;
          }
          store.put(sequence, SEQUENCE_KEY);
        };
        transaction.oncomplete = () => sequence === undefined
          ? reject(new Error('No fue posible guardar la secuencia de navegación.'))
          : resolve(sequence);
        transaction.onerror = () => reject(transaction.error ?? new Error('No fue posible guardar la secuencia de navegación.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('No fue posible guardar la secuencia de navegación.'));
      });
    } finally {
      database.close();
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No fue posible abrir el almacenamiento de navegación.'));
      request.onblocked = () => reject(new Error('El almacenamiento de navegación está bloqueado por otra pestaña.'));
    });
  }
}

export const SEGUIMIENTO_NAVIGATION_COORDINATOR = new InjectionToken<SeguimientoNavigationCoordinator>(
  'Seguimiento navigation coordinator',
  { providedIn: 'root', factory: () => new BrowserSeguimientoNavigationCoordinator() }
);

export const SEGUIMIENTO_NAVIGATION_TYPE = new InjectionToken<string>('Seguimiento navigation type', {
  providedIn: 'root',
  factory: () => (globalThis.performance?.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'navigate'
});

export interface SeguimientoRequestOptions {
  withCredentials: true;
  context: HttpContext;
  headers: HttpHeaders;
}

@Injectable({ providedIn: 'root' })
export class SeguimientoNavigationService {
  private readonly http = inject(HttpClient);
  private readonly navigationType = inject(SEGUIMIENTO_NAVIGATION_TYPE);
  private readonly coordinator = inject(SEGUIMIENTO_NAVIGATION_COORDINATOR);
  private navigationId = crypto.randomUUID();
  private navigationSequence?: number;
  private generation = 0;
  private initialization?: Observable<string>;
  private allowReloadResume = this.navigationType === 'reload';
  private reloadNeedsStart = false;

  private pending: Array<() => void> = [];
  private requesting = false;

  private serial<T>(operation: () => Observable<T>): Observable<T> {
    return new Observable<T>(subscriber => {
      const start = () => {
        if (subscriber.closed) { this.advance(); return; }
        // Keep the active request alive until completion: aborting HTTP does not
        // release a server lock. Cancelled queued operations never reach the BFF.
        try {
          operation().subscribe({ next: value => subscriber.next(value),
            error: error => { subscriber.error(error); this.advance(); },
            complete: () => { subscriber.complete(); this.advance(); } });
        } catch (error) { subscriber.error(error); this.advance(); }
      };
      this.pending.push(start);
      if (!this.requesting) this.advance();
    });
  }

  private advance(): void {
    const next = this.pending.shift();
    this.requesting = !!next;
    next?.();
  }

  request<T>(operation: (options: SeguimientoRequestOptions) => Observable<T>): Observable<T> {
    return defer(() => {
      const generation = this.generation;
      return this.initialize().pipe(switchMap(context => {
        this.requireCurrentNavigation(generation);
        return this.serial(() => {
          this.requireCurrentNavigation(generation);
          return operation(this.options(context));
        }).pipe(map(response => {
          this.requireCurrentNavigation(generation);
          return response;
        }));
      }));
    });
  }

  restartForNavigation(): Observable<void> {
    // Restoring a page from bfcache is a new visit even though its JS heap survived.
    this.generation++;
    this.navigationId = crypto.randomUUID();
    this.navigationSequence = undefined;
    this.allowReloadResume = false;
    this.reloadNeedsStart = false;
    this.initialization = undefined;
    return this.initialize().pipe(map(() => undefined));
  }

  private initialize(): Observable<string> {
    if (!this.initialization) {
      const generation = this.generation;
      const navigationId = this.navigationId;
      const begin = () => this.beginNavigation(generation, navigationId);
      const initialization = this.allowReloadResume && !this.reloadNeedsStart
        ? this.http.get<unknown>('/api/seguimiento-prospecto/sesion', this.options()).pipe(
          catchError(error => {
            if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
            this.reloadNeedsStart = true;
            return begin();
          }))
        : begin();
      this.initialization = this.serial(() => initialization).pipe(map(response => {
        this.requireCurrentNavigation(generation);
        const result = response as { success?: unknown; context?: unknown } | null;
        if (result?.success !== true || typeof result.context !== 'string'
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.context)) {
          throw new Error('No fue posible confirmar la sesión de seguimiento.');
        }
        return result.context;
      }), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.initialization;
  }

  private beginNavigation(generation: number, navigationId: string): Observable<unknown> {
    return defer(() => {
      this.requireCurrentNavigation(generation);
      const post = (navigationSequence: number) => firstValueFrom(this.http.post<unknown>(
        '/api/seguimiento-prospecto/iniciar',
        { navigationId, navigationSequence },
        this.options()
      ));
      const currentSequence = this.navigationSequence;
      return from(currentSequence === undefined
        ? this.coordinator.withNextSequence(sequence => {
          this.requireCurrentNavigation(generation);
          this.navigationSequence = sequence;
          return post(sequence);
        })
        : this.coordinator.withLock(() => {
          this.requireCurrentNavigation(generation);
          return post(currentSequence);
        }));
    });
  }

  private options(context?: string): SeguimientoRequestOptions {
    let headers = new HttpHeaders({ 'X-Portal-Request': '1' });
    if (context) headers = headers.set('X-Seguimiento-Context', context);
    return { withCredentials: true, context: new HttpContext().set(SKIP_AUTH_TOKEN, true), headers };
  }

  private requireCurrentNavigation(generation: number): void {
    if (generation !== this.generation) throw new Error('La navegación de seguimiento cambió.');
  }
}
