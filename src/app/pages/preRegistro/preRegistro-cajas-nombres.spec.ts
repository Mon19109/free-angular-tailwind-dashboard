import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { PreRegistroComponent } from './preRegistro.component';

describe('Preregistro: nombres de cajas', () => {
 let c: any;
 beforeEach(() => {
  TestBed.configureTestingModule({providers:[provideHttpClient(),{provide:ActivatedRoute,useValue:{}},{provide:ChangeDetectorRef,useValue:{detectChanges(){}}}]});
  c=TestBed.runInInjectionContext(()=>new PreRegistroComponent());
  spyOn(c,'guardarBorradorSilencioso');
  c.arbolRegistrado=[{id:'entidad',nombre:'Entidad',nivel:'entidad',hijos:[1,2].map(n=>({id:`s${n}`,nombre:`Sucursal ${n}`,nivel:'sucursal',hijos:[1,2,3].map(i=>({id:`s${n}-c${i}`,nombre:`CAJA 0${i}`,nivel:'caja'}))}))}];
  c.arbolNegocioForm.controls.datosPorSucursal.setValue(JSON.stringify({s1:{nombreComercial:'Holla food'},s2:{nombreComercial:'Otra sucursal'}}));
 });
 it('genera nombres con el padre propio y dos dígitos después del alta',()=>{
  const branches=c.arbolNegocioWizard[0].hijos;
  expect(branches[0].hijos.map((n:any)=>n.nombre)).toEqual(['CAJA Holla food 01','CAJA Holla food 02','CAJA Holla food 03']);
  expect(branches[1].hijos[0].nombre).toBe('CAJA Otra sucursal 01');
 });
 it('sincroniza nombre personalizado del árbol o formulario, ubicación y payload al reanudar',()=>{
  c.arbolNegocioForm.controls.nodoSeleccionado.setValue('s1-c1');
  c.renombrarNodoArbol('s1-c1','Caja terraza');
  expect(c.nombreCajaSeleccionada).toBe('Caja terraza');
  expect(c.ubicacionArbolSeleccionada).toContain('Caja terraza');
  const saved=c.arbolNegocioForm.controls.nombresArbol.value;
  c.arbolNegocioForm.controls.nodoSeleccionado.setValue('s2-c1');
  c.arbolNegocioForm.controls.nombresArbol.setValue(saved);
  c.arbolNegocioForm.controls.nodoSeleccionado.setValue('s1-c1');
  expect(c.nombreCajaSeleccionada).toBe('Caja terraza');
  spyOn(c,'construirComercioPayload').and.returnValue({nameCommerce:'Anterior',name:'Anterior'});
  expect(c.datosActualizacion('s1-c1')).toEqual({nameCommerce:'Caja terraza',name:'Caja terraza'});
 });
 it('conserva nombres personalizados recuperados del servidor',()=>{
  c.arbolRegistrado[0].hijos[0].hijos[0].nombre='Caja personalizada';
  expect(c.arbolNegocioWizard[0].hijos[0].hijos[0].nombre).toBe('Caja personalizada');
 });
});
