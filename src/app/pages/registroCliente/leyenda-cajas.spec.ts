import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { DashboardPreregistroClientesComponent } from '../dashboardPreregistroClientes/dashboardPreregistroClientes.component';
import { RegistroClienteComponent } from './registroCliente.component';
import { AgregarNivelComercioComponent } from '../agregarNivelComercio/agregarNivelComercio.component';

const mensaje = 'Usuario de Cajas para operar la terminal TPV';
const avisos = (root: HTMLElement) => Array.from(root.querySelectorAll('[role="note"]'))
  .filter(node => node.textContent?.trim() === mensaje);

describe('Leyenda contextual de cajas en pantallas internas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RegistroClienteComponent, AgregarNivelComercioComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: EMPTY, snapshot: { queryParamMap: convertToParamMap({}) } } }
    ] });
  });

  it('permanece una sola vez al contraer, consultar y editar y cambia con el nivel real del nodo', () => {
    const fixture = TestBed.createComponent(RegistroClienteComponent);
    const component = fixture.componentInstance;
    component.contextoBff = { success: true, commerce: { ref: 'root' }, capabilities: {} } as any;
    component.arbolServicio = [
      { id: 'caja-1', nombre: 'Terminal principal', nivel: 'caja' },
      { id: 'caja-2', nombre: 'Terminal secundaria', nivel: 'caja' },
      { id: 'sucursal', nombre: 'CAJA en el nombre no determina el nivel', nivel: 'sucursal' },
      { id: 'entidad', nombre: 'Entidad', nivel: 'entidad' }
    ];
    for (const id of ['caja-1', 'sucursal', 'entidad', 'caja-2', 'caja-1']) {
      component.nodoSeleccionado = id;
      component.contextoSeleccionado = { email: '', idComercio: id, nivel: '', nombreComercial: id, rfc: '' };
      for (const abierta of [null, 'comercio'] as const) for (const editando of [false, true]) {
        component.seccionAbierta = abierta;
        component.editandoDatosNodo = editando;
        fixture.detectChanges();
        const notes = avisos(fixture.nativeElement);
        expect(notes.length).withContext(`${id}, sección ${abierta}, edición ${editando}`).toBe(id.startsWith('caja-') ? 1 : 0);
        if (notes.length) {
          expect(notes[0].closest('.section-card')).toBeNull();
          const dark = document.documentElement.classList.contains('dark');
          try {
            document.documentElement.classList.remove('dark');
            const lightColor = getComputedStyle(notes[0]).color;
            document.documentElement.classList.add('dark');
            expect(getComputedStyle(notes[0]).color).not.toBe(lightColor);
          } finally { document.documentElement.classList.toggle('dark', dark); }
          expect(fixture.nativeElement.querySelector('.context-strip').nextElementSibling).toBe(notes[0]);
        }
      }
    }
  });

  it('Agregar Nivel muestra el aviso solo para el nodo seleccionado de nivel Caja', () => {
    spyOn(AgregarNivelComercioComponent.prototype, 'ngOnInit').and.stub();
    const fixture = TestBed.createComponent(AgregarNivelComercioComponent);
    for (const nivel of ['Caja', 'Sucursal', 'Entidad', 'Caja'] as const) {
      fixture.componentInstance.nodoSeleccionado = { id: nivel, llave: nivel, nombre: 'Nombre libre', nivel, hijos: [] };
      fixture.detectChanges();
      expect(avisos(fixture.nativeElement).length).toBe(nivel === 'Caja' ? 1 : 0);
    }
  });
  it('Dashboard de Prospectos abre el mismo contexto de Registro de Cliente al consultar o editar', () => {
    const component = Object.create(DashboardPreregistroClientesComponent.prototype) as DashboardPreregistroClientesComponent;
    const navigate = jasmine.createSpy('navigate');
    Object.assign(component, { router: { navigate } });
    Object.defineProperty(component, 'puedeEditarInformacion', { value: true });
    component.ejecutarAccion('editarInformacion', { ref: 'opaque-ref', nivel: 'Caja' } as any);
    expect(navigate).toHaveBeenCalledOnceWith(['/registro_cliente'], { queryParams: { ref: 'opaque-ref' } });
  });

});
