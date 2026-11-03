import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authTokenInterceptor } from './auth-token.interceptor';
import { PreRegistroService } from './preregistro.service';
import { SeguimientoProspectoService } from './seguimiento-prospecto.service';
import {
  SEGUIMIENTO_NAVIGATION_COORDINATOR,
  SEGUIMIENTO_NAVIGATION_TYPE,
  SeguimientoNavigationService
} from './seguimiento-navigation.service';
import { of } from 'rxjs';

describe('SeguimientoProspectoService (BFF)', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting(),
        { provide: SEGUIMIENTO_NAVIGATION_TYPE, useValue: 'navigate' },
        { provide: SEGUIMIENTO_NAVIGATION_COORDINATOR, useValue: {
          withNextSequence<T>(operation: (sequence: number) => Promise<T>) { return operation(1); },
          withLock<T>(operation: () => Promise<T>) { return operation(); }
        } }]
    });
    spyOn(localStorage, 'getItem').and.callFake(key => key === 'token' ? 'token-de-sesion' : null);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SeguimientoNavigationService).request(() => of(undefined)).subscribe();
    http.expectOne('/api/seguimiento-prospecto/iniciar').flush({ success: true, context: '00000000-0000-4000-8000-000000000001' });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  afterEach(() => http.verify());

  it('envía PUT al BFF sin token del navegador y no afecta otras peticiones', () => {
    let completado = false;
    TestBed.inject(SeguimientoProspectoService).completar('token_seguimiento-123').subscribe(() => completado = true);
    const req = http.expectOne('/api/seguimiento-prospecto/completar');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.has('versionApp')).toBeFalse();
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-Portal-Request')).toBe('1');
    expect(req.request.headers.get('X-Seguimiento-Context')).toBe('00000000-0000-4000-8000-000000000001');
    req.flush({ success: true });
    expect(completado).toBeTrue();
    TestBed.inject(HttpClient).get('/otra-consulta').subscribe();
    const otra = http.expectOne('/otra-consulta');
    expect(otra.request.headers.has('Authorization')).toBeFalse();
    expect(otra.request.headers.has('X-Seguimiento-Context')).toBeFalse();
    otra.flush({});
  });

  it('no publica mensajes crudos de finalización fallida', () => {
    let mensaje = '';
    TestBed.inject(SeguimientoProspectoService).completar('token_seguimiento-123').subscribe({
      error: (error: Error) => mensaje = error.message
    });
    http.expectOne('/api/seguimiento-prospecto/completar')
      .flush({ success: false, message: 'Seguimiento no encontrado' });
    expect(mensaje).toBe('No fue posible confirmar la finalización del seguimiento del prospecto.');
  });

  for (const response of [null, {}, { success: 'true' }]) it('no confirma respuestas de finalización inválidas', () => {
    let completed = false, failed = false;
    TestBed.inject(SeguimientoProspectoService).completar('opaque-link').subscribe({ next: () => completed = true, error: () => failed = true });
    http.expectOne('/api/seguimiento-prospecto/completar').flush(response);
    expect(completed).toBeFalse(); expect(failed).toBeTrue();
  });

  it('consulta giros públicos del BFF sin bearer, incluso con token legacy almacenado', () => {
    TestBed.inject(PreRegistroService).getGirosByFamily('780', true).subscribe();
    const req = http.expectOne('/preregistro/giros?family=780');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ data: [{ giro: 780, descripcion: 'Descripción pública' }] });
  });

  it('mantiene documentos, liquidación y accesos en el contexto protegido del BFF', () => {
    const seguimiento = TestBed.inject(SeguimientoProspectoService);
    const assertContext = (url: string, method: string) => {
      const request = http.expectOne(url);
      expect(request.request.method).toBe(method);
      expect(request.request.headers.get('X-Seguimiento-Context')).toBe('00000000-0000-4000-8000-000000000001');
      expect(request.request.headers.has('Authorization')).toBeFalse();
      expect(request.request.withCredentials).toBeTrue();
      return request;
    };

    seguimiento.consultarDocumentos().subscribe();
    assertContext('/api/seguimiento-prospecto/documentos', 'GET')
      .flush({ success: true, documents: [] });
    seguimiento.consultarLiquidacionNodo('node/ref').subscribe();
    assertContext('/api/seguimiento-prospecto/nodos/node%2Fref/liquidacion', 'GET')
      .flush({ success: true });
    seguimiento.guardarLiquidacion(new FormData()).subscribe();
    assertContext('/api/seguimiento-prospecto/liquidacion', 'POST')
      .flush({ success: true });
    seguimiento.guardarAccesos('node/ref', []).subscribe();
    assertContext('/api/seguimiento-prospecto/nodos/node%2Fref/accesos', 'POST')
      .flush({ success: true });
  });
});
