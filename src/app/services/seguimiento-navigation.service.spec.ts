import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { authTokenInterceptor, SKIP_AUTH_TOKEN } from './auth-token.interceptor';
import { ProspectoClienteService } from './prospecto-cliente.service';
import { SeguimientoProspectoService } from './seguimiento-prospecto.service';
import {
  SEGUIMIENTO_NAVIGATION_COORDINATOR,
  SEGUIMIENTO_NAVIGATION_TYPE,
  SeguimientoNavigationCoordinator,
  SeguimientoNavigationService
} from './seguimiento-navigation.service';

class SharedNavigationCoordinator implements SeguimientoNavigationCoordinator {
  private sequence = 0;
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  withNextSequence<T>(operation: (sequence: number) => Promise<T>): Promise<T> {
    return this.withLock(() => operation(++this.sequence));
  }

  withLock<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.locked = true;
        let result: Promise<T>;
        try {
          result = operation();
        } catch (error) {
          result = Promise.reject(error);
        }
        const release = () => {
          this.locked = false;
          this.waiters.shift()?.();
        };
        result.then(value => {
          resolve(value);
          release();
        }, error => {
          reject(error);
          release();
        });
      };
      if (this.locked) this.waiters.push(run);
      else run();
    });
  }
}

const settleNavigation = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('Seguimiento: contexto del BFF por navegación', () => {
  const context = '00000000-0000-4000-8000-000000000001';
  const nextContext = '00000000-0000-4000-8000-000000000002';
  let http: HttpTestingController;
  let coordinator: SharedNavigationCoordinator;

  function setup(type = 'navigate'): SeguimientoNavigationService {
    coordinator = new SharedNavigationCoordinator();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting(),
      { provide: SEGUIMIENTO_NAVIGATION_TYPE, useValue: type },
      { provide: SEGUIMIENTO_NAVIGATION_COORDINATOR, useValue: coordinator }
    ] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(SeguimientoNavigationService);
  }

  afterEach(() => http?.verify());

  it('serializa documentos y liquidación; BUSY sigue siendo error y permite reintento explícito', async () => {
    setup(); const service = TestBed.inject(SeguimientoProspectoService);
    const errors: number[] = [];
    service.consultarDocumentos('node').subscribe({ error: error => errors.push(error.status) });
    service.consultarLiquidacionNodo('node').subscribe();
    http.expectOne('/api/seguimiento-prospecto/iniciar').flush({ success: true, context });
    await settleNavigation();
    const documents = http.expectOne('/api/seguimiento-prospecto/nodos/node/documentos');
    http.expectNone('/api/seguimiento-prospecto/nodos/node/liquidacion');
    documents.flush({ code: 'SEGUIMIENTO_BUSY' }, { status: 409, statusText: 'Conflict' });
    expect(errors).toEqual([409]);
    http.expectNone('/api/seguimiento-prospecto/nodos/node/documentos');
    http.expectOne('/api/seguimiento-prospecto/nodos/node/liquidacion').flush({ success: true });
    service.consultarDocumentos('node').subscribe();
    http.expectOne('/api/seguimiento-prospecto/nodos/node/documentos').flush({ success: true, documents: [] });
  });

  it('inicia una sola vez con el contrato nuevo y comparte el contexto entre servicios', async () => {
    setup();
    TestBed.inject(ProspectoClienteService).obtenerProspecto('ignorar', 'fixture-link').subscribe();
    TestBed.inject(SeguimientoProspectoService).consultarCuenta().subscribe();
    const begin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(begin.request.method).toBe('POST');
    expect(Object.keys(begin.request.body)).toEqual(['navigationId', 'navigationSequence']);
    expect(begin.request.body.navigationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(begin.request.body.navigationSequence).toBe(1);
    expect(begin.request.withCredentials).toBeTrue();
    expect(begin.request.context.get(SKIP_AUTH_TOKEN)).toBeTrue();
    expect(begin.request.headers.get('X-Portal-Request')).toBe('1');
    expect(begin.request.headers.has('X-Seguimiento-Context')).toBeFalse();
    expect(begin.request.headers.has('Authorization')).toBeFalse();
    http.expectNone('/api/seguimiento-prospecto/cuenta');

    begin.flush({ success: true, context });
    await settleNavigation();
    for (const url of ['/api/seguimiento-prospecto/prospecto', '/api/seguimiento-prospecto/cuenta']) {
      const request = http.expectOne(url);
      expect(request.request.method).toBe(url.endsWith('/prospecto') ? 'POST' : 'GET');
      if (url.endsWith('/prospecto')) expect(request.request.body).toEqual({ link: 'fixture-link' });
      expect(request.request.headers.get('X-Seguimiento-Context')).toBe(context);
      expect(request.request.withCredentials).toBeTrue();
      request.flush({ success: true });
    }
    TestBed.inject(SeguimientoProspectoService).renovarAcceso().subscribe();
    const renewal = http.expectOne('/api/seguimiento-prospecto/renovar');
    expect(renewal.request.headers.get('X-Seguimiento-Context')).toBe(context);
    renewal.flush({ success: true });
    http.expectNone('/api/seguimiento-prospecto/iniciar');
  });

  it('recarga recupera la sesión existente mediante GET sin iniciar otra navegación', async () => {
    const navigation = setup('reload');
    let received = '';
    navigation.request(options => of(options.headers.get('X-Seguimiento-Context')!)).subscribe(value => received = value);
    const session = http.expectOne('/api/seguimiento-prospecto/sesion');
    expect(session.request.method).toBe('GET');
    expect(session.request.withCredentials).toBeTrue();
    expect(session.request.headers.has('X-Seguimiento-Context')).toBeFalse();
    session.flush({ success: true, context });
    await settleNavigation();
    expect(received).toBe(context);
    http.expectNone('/api/seguimiento-prospecto/iniciar');
  });

  it('recarga inicia con una secuencia nueva sólo si GET /sesion responde 401', async () => {
    const navigation = setup('reload');
    let requested = false;
    navigation.request(() => of(true)).subscribe(value => requested = value);
    http.expectOne('/api/seguimiento-prospecto/sesion').flush({}, { status: 401, statusText: 'Unauthorized' });
    const begin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(begin.request.body.navigationSequence).toBe(1);
    begin.flush({ success: true, context });
    await settleNavigation();
    expect(requested).toBeTrue();
  });

  for (const status of [403, 409, 502, 503]) {
    it(`no inicia ni realiza la operación ante error ${status} de sesión`, async () => {
      const navigation = setup('reload');
      let error: unknown;
      const operation = jasmine.createSpy('operation').and.returnValue(of(true));
      navigation.request(operation).subscribe({ error: value => error = value });
      http.expectOne('/api/seguimiento-prospecto/sesion').flush({}, { status, statusText: 'Unavailable' });
      await settleNavigation();
      expect(error).toBeDefined();
      expect(operation).not.toHaveBeenCalled();
      http.expectNone('/api/seguimiento-prospecto/iniciar');
    });
  }

  for (const response of [null, {}, { success: false, context }, { success: true, context: 'invalid' }]) {
    it('rechaza respuestas de inicio malformadas sin autorizar solicitudes', async () => {
      const navigation = setup();
      let failed = false;
      const operation = jasmine.createSpy('operation').and.returnValue(of(true));
      navigation.request(operation).subscribe({ error: () => failed = true });
      http.expectOne('/api/seguimiento-prospecto/iniciar').flush(response);
      await settleNavigation();
      expect(failed).toBeTrue();
      expect(operation).not.toHaveBeenCalled();
    });
  }

  it('una apertura de historial nueva comienza otra navegación', () => {
    const navigation = setup('back_forward');
    navigation.request(() => of(true)).subscribe();
    const begin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(begin.request.body.navigationSequence).toBe(1);
    begin.flush({ success: true, context });
    http.expectNone('/api/seguimiento-prospecto/sesion');
  });

  it('restaurar desde bfcache crea una secuencia nueva y descarta respuestas anteriores', async () => {
    const navigation = setup();
    const client = TestBed.inject(HttpClient);
    let oldDelivered = false;
    let oldRejected = false;
    let newContext = '';
    navigation.request(options => client.get('/api/seguimiento-prospecto/cuenta', options))
      .subscribe({ next: () => oldDelivered = true, error: () => oldRejected = true });
    const firstBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    const firstId = firstBegin.request.body.navigationId;
    firstBegin.flush({ success: true, context });
    await settleNavigation();
    const previousRequest = http.expectOne('/api/seguimiento-prospecto/cuenta');

    navigation.restartForNavigation().subscribe();
    navigation.request(options => of(options.headers.get('X-Seguimiento-Context')!)).subscribe(value => newContext = value);
    http.expectNone('/api/seguimiento-prospecto/iniciar');
    previousRequest.flush({ success: true });
    const secondBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(secondBegin.request.body.navigationId).not.toBe(firstId);
    expect(secondBegin.request.body.navigationSequence).toBe(2);
    secondBegin.flush({ success: true, context: nextContext });
    await settleNavigation();
    expect(newContext).toBe(nextContext);
    expect(oldDelivered).toBeFalse();
    expect(oldRejected).toBeTrue();
  });

  it('no reintenta escrituras fallidas ni propaga el contexto a otros servicios', async () => {
    setup();
    let failed = false;
    TestBed.inject(SeguimientoProspectoService).guardarAccesos(context, []).subscribe({ error: () => failed = true });
    http.expectOne('/api/seguimiento-prospecto/iniciar').flush({ success: true, context });
    await settleNavigation();
    const path = `/api/seguimiento-prospecto/nodos/${context}/accesos`;
    const write = http.expectOne(path);
    expect(write.request.headers.get('X-Seguimiento-Context')).toBe(context);
    write.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toBeTrue();
    http.expectNone(path);
    http.expectNone('/api/seguimiento-prospecto/iniciar');
    TestBed.inject(HttpClient).get('/api/otra-consulta').subscribe();
    const other = http.expectOne('/api/otra-consulta');
    expect(other.request.headers.has('X-Seguimiento-Context')).toBeFalse();
    other.flush({});
  });

  it('conserva la secuencia al cerrar y abrir una nueva instancia', async () => {
    const firstNavigation = setup();
    firstNavigation.request(() => of(true)).subscribe();
    const firstBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(firstBegin.request.body.navigationSequence).toBe(1);
    firstBegin.flush({ success: true, context });
    await settleNavigation();

    const reopenedNavigation = TestBed.runInInjectionContext(() => new SeguimientoNavigationService());
    reopenedNavigation.request(() => of(true)).subscribe();
    const reopenedBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(reopenedBegin.request.body.navigationSequence).toBe(2);
    expect(reopenedBegin.request.body.navigationId).not.toBe(firstBegin.request.body.navigationId);
    reopenedBegin.flush({ success: true, context: nextContext });
    await settleNavigation();
  });

  it('serializa los inicios de dos pestañas compartiendo la secuencia', async () => {
    setup();
    const firstTab = TestBed.inject(SeguimientoNavigationService);
    const secondTab = TestBed.runInInjectionContext(() => new SeguimientoNavigationService());
    let firstContext = '';
    let secondContext = '';
    firstTab.request(options => of(options.headers.get('X-Seguimiento-Context')!)).subscribe(value => firstContext = value);
    secondTab.request(options => of(options.headers.get('X-Seguimiento-Context')!)).subscribe(value => secondContext = value);

    const firstBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(firstBegin.request.body.navigationSequence).toBe(1);
    http.expectNone('/api/seguimiento-prospecto/iniciar');
    firstBegin.flush({ success: true, context });
    await settleNavigation();

    const secondBegin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(secondBegin.request.body.navigationSequence).toBe(2);
    secondBegin.flush({ success: true, context: nextContext });
    await settleNavigation();
    expect(firstContext).toBe(context);
    expect(secondContext).toBe(nextContext);
  });

  it('reintenta la misma navegación con el mismo identificador y secuencia', async () => {
    const navigation = setup();
    let failed = false;
    navigation.request(() => of(true)).subscribe({ error: () => failed = true });
    const firstAttempt = http.expectOne('/api/seguimiento-prospecto/iniciar');
    const firstBody = firstAttempt.request.body;
    firstAttempt.flush({}, { status: 503, statusText: 'Unavailable' });
    await settleNavigation();
    expect(failed).toBeTrue();

    navigation.request(() => of(true)).subscribe();
    const retry = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(retry.request.body).toEqual(firstBody);
    retry.flush({ success: true, context });
    await settleNavigation();
  });

  it('no autoriza operaciones si el BFF rechaza un contexto anterior', async () => {
    const navigation = setup();
    let failed = false;
    const operation = jasmine.createSpy('operation').and.returnValue(of(true));
    navigation.request(operation).subscribe({ error: () => failed = true });
    const begin = http.expectOne('/api/seguimiento-prospecto/iniciar');
    begin.flush({ success: false, code: 'SEGUIMIENTO_NAVIGATION_SUPERSEDED' }, {
      status: 409,
      statusText: 'Conflict'
    });
    await settleNavigation();
    expect(failed).toBeTrue();
    expect(operation).not.toHaveBeenCalled();
    http.expectNone('/api/seguimiento-prospecto/cuenta');
  });

  it('no entrega dos inicios concurrentes en orden inverso', async () => {
    setup();
    const firstTab = TestBed.inject(SeguimientoNavigationService);
    const secondTab = TestBed.runInInjectionContext(() => new SeguimientoNavigationService());
    firstTab.request(() => of(true)).subscribe();
    secondTab.request(() => of(true)).subscribe();
    const earlier = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(earlier.request.body.navigationSequence).toBe(1);
    http.expectNone('/api/seguimiento-prospecto/iniciar');
    earlier.flush({ success: true, context });
    await settleNavigation();

    const later = http.expectOne('/api/seguimiento-prospecto/iniciar');
    expect(later.request.body.navigationSequence).toBe(2);
    later.flush({ success: true, context: nextContext });
    await settleNavigation();
  });
});
