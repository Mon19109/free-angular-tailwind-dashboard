import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActividadesService } from './actividades.service';
import { RegimenFiscalService } from './regimen-fiscal.service';
import { LocalidadesService } from './localidades.service';
import { PreRegistroService } from './preregistro.service';
import { BeneficiariosService } from './beneficiarios.service';
import { authTokenInterceptor } from './auth-token.interceptor';
import { environment } from '../environments/environments';

describe('Catálogos públicos del prerregistro', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('todas las URLs públicas están bajo /preregistro/', () => {
    Object.values(environment.preregistroBff).forEach(url => {
      expect(url.startsWith('/preregistro/')).toBeTrue();
      expect(url.includes('/bff/')).toBeFalse();
    });
  });

  it('comparte la petición de actividades y conserva campos sin Authorization', () => {
    const service = TestBed.inject(ActividadesService);
    const actividades = [{ idcat_actividades: 7, actividad: 'Comercio', extra: 'conservado' }];
    let primera: unknown;
    let segunda: unknown;
    service.getActividades(true).subscribe(data => primera = data);
    service.getActividades(true).subscribe(data => segunda = data);
    const req = http.expectOne(environment.preregistroBff.actividadesUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true, catActividadResponse: actividades });
    expect(primera).toEqual(actividades);
    expect(segunda).toEqual(actividades);
  });

  it('preserva filtros y parámetros de localidades, giros, tipos e instituciones', () => {
    TestBed.inject(LocalidadesService).obtenerPorCodigoPostal('01234', true).subscribe();
    http.expectOne(environment.preregistroBff.localidadesUrl + '/01234').flush({ rows: [] });
    TestBed.inject(PreRegistroService).getGirosByFamily('Café & pan', true).subscribe();
    const giros = http.expectOne(r => r.url === environment.preregistroBff.girosUrl);
    expect(giros.request.params.get('family')).toBe('Café & pan');
    giros.flush([]);
    TestBed.inject(PreRegistroService).getTiposComercio(4, true).subscribe();
    const tipos = http.expectOne(r => r.url === environment.preregistroBff.tiposComercioUrl);
    expect(tipos.request.params.get('idAffiliationType')).toBe('4');
    tipos.flush([]);
    TestBed.inject(BeneficiariosService).buscarInstitucion('001234567890', undefined, true).subscribe();
    const banco = http.expectOne(r => r.url === environment.preregistroBff.institucionesUrl);
    expect(banco.request.params.get('value')).toBe('001234567890');
    expect(banco.request.headers.has('Authorization')).toBeFalse();
    banco.flush({ institutionResponse: { institutions: [] } });
  });

  it('conserva etiquetas fiscales y permite reintento manual tras error', () => {
    const service = TestBed.inject(RegimenFiscalService);
    let failed = false;
    service.getAllOptions(true).subscribe({ error: () => failed = true });
    http.expectOne(environment.preregistroBff.regimenesFiscalesUrl)
      .flush({ success: false }, { status: 502, statusText: 'Bad Gateway' });
    expect(failed).toBeTrue();
    let result: string[] = [];
    service.getAllOptions(true).subscribe(data => result = data);
    http.expectOne(environment.preregistroBff.regimenesFiscalesUrl)
      .flush({ data: [{ code: '601', description: 'General' }] });
    expect(result).toEqual(['601 - General']);
  });

  it('mantiene el endpoint anterior para consumidores compartidos sin la opción pública', () => {
    TestBed.inject(ActividadesService).getActividades().subscribe();
    http.expectOne('/api/v3/antares.kwt-v2.2.10/api/v1/getActividades').flush([]);
  });
});
