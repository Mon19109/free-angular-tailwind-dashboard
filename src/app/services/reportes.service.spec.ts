import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReportesService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ReportesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the selected account GUID for folder and file requests', () => {
    service.buscarFolderReportes('2026 Agosto', 'ADQUIRENTE', 'GUID-CUENTA').subscribe();
    const folder = http.expectOne(request => request.url.endsWith('/api/reportes/directorio'));
    expect(folder.request.params.get('guidComerce')).toBe('GUID-CUENTA');
    folder.flush([]);

    service.buscarArchivosReporte('2026 Agosto', 'ADQUIRENTE', 'EnRed', 'OTRO-GUID').subscribe();
    const archivo = http.expectOne(request => request.url.endsWith('/api/reportes/archivos'));
    expect(archivo.request.params.get('reporte')).toBe('EnRed');
    archivo.flush([]);
  });
});
