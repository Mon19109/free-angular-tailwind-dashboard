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
    const folder = http.expectOne(request => request.url.endsWith('listFilesInDirectory'));
    expect(folder.request.params.get('folderName')).toBe('GUID-CUENTA/Reportes/2026/08/Adquirencia/');
    folder.flush([]);

    service.buscarArchivosReporte('2026 Agosto', 'ADQUIRENTE', 'EnRed', 'OTRO-GUID').subscribe();
    const archivo = http.expectOne(request => request.url.endsWith('listFilesInDirectory'));
    expect(archivo.request.params.get('folderName')).toBe('OTRO-GUID/Reportes/2026/08/Adquirencia/EnRed');
    archivo.flush([]);
  });
});
