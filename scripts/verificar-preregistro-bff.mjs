// Pruebas locales: HttpClient simulado, sin solicitudes de red ni registros reales.
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temp = await mkdtemp(join(tmpdir(), 'preregistro-bff-'));
try {
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import '@angular/compiler';
      import assert from 'node:assert/strict';
      import { createEnvironmentInjector, runInInjectionContext, ChangeDetectorRef } from '@angular/core';
      import { FormBuilder } from '@angular/forms';
      import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
      import { of, Subject } from 'rxjs';
      import { PreregistroCompletoService } from './src/app/services/preregistro-completo.service';
      import { PreRegistroComponent } from './src/app/pages/preRegistro/preRegistro.component';
      import { RegimenFiscalService } from './src/app/services/regimen-fiscal.service';
      import { LocalidadesService } from './src/app/services/localidades.service';
      import { PreRegistroService } from './src/app/services/preregistro.service';
      import { ValidarAfiliacionService } from './src/app/services/validar-afiliacion.service';
      import { SKIP_AUTH_TOKEN } from './src/app/services/auth-token.interceptor';
      const storage = new Map();
      globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
      globalThis.window = { scrollTo() {} };
      let calls = [];
      let response = new Subject();
      const injector = createEnvironmentInjector([
        FormBuilder,
        {provide: ChangeDetectorRef, useValue: {detectChanges() {}}},
        {provide: RegimenFiscalService, useValue: {getAllOptions: () => of([])}},
        {provide: LocalidadesService, useValue: {}},
        {provide: PreRegistroService, useValue: {}},
        ValidarAfiliacionService,
        {provide: HttpClient, useValue: {post: (...args) => { calls.push(args); return response; }}},
        PreregistroCompletoService,
      ]);
      const service = injector.get(PreregistroCompletoService);
      const fileA = new File(['A'], 'primero.pdf', {type: 'application/pdf'});
      const fileB = new File(['B'], 'segundo.png', {type: 'image/png'});
      const documentos = [
        {nodoId:'entidad-1',numeroDocumento:'2',file:fileA},
        {nodoId:'sucursal-1',numeroDocumento:'5',file:fileB}
      ];
      const payload = {entitys:[{branchOficces:[{nameCommerce:'Captura',poss:[{name:'Caja'}]}]}]};
      const arbol = [{id:'entidad-1',hijos:[{id:'sucursal-1'}]}];
      for (const tipoNegocio of ['individual','empresa-holding','sucursales-multiples','auditor-unico']) {
        const body = service.construirFormData({comprobante:'prueba',tipoNegocio,payload,arbol,documentos});
        assert.deepEqual(JSON.parse(body.get('datos')), {payload,arbol,documentos: documentos.map(({file,...d})=>d)});
        assert.equal(body.get('tipoNegocio'),tipoNegocio);
        assert.deepEqual(await Promise.all(body.getAll('files').map(f=>f.text())), ['A','B']);
        const request = new Request('https://example.invalid', {method:'POST',body});
        assert.ok(request.headers.get('content-type').startsWith('multipart/form-data; boundary='));
      }
      assert.throws(()=> service.construirFormData({comprobante:'',tipoNegocio:'individual',payload,arbol,documentos}));
      service.enviarPreRegistro({comprobante:'prueba',tipoNegocio:'individual',payload,arbol,documentos}).subscribe();
      assert.equal(calls[0][0], '/bff/preregistro/registro-completo');
      assert.equal(calls[0][2].context.get(SKIP_AUTH_TOKEN),true);
      assert.equal(calls[0][2].headers,undefined);
      const component = runInInjectionContext(injector, ()=>new PreRegistroComponent());
      component.guardarBorradorSilencioso = () => {};
      component.tipoNegocioSeleccionado = {id:'comercio-unico'};
      assert.equal(component.tipoNegocioBff(),'individual');
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;
      const token = 'a'.repeat(64); // Fixture local, nunca se envía a un servidor.
      component.irAlPaso = paso => { component.pasoActual = paso; };
      const validar = () => {
        response = new Subject(); calls = [];
        component.continuarAfiliacion();
        assert.equal(calls.length,1);
        assert.equal(calls[0][0],'/bff/preregistro/afiliacion/validar');
        assert.deepEqual(calls[0][1],{affiliationNumber:component.afiliacionForm.controls.afiliacion.value});
        assert.equal(calls[0][2].context.get(SKIP_AUTH_TOKEN),true);
        assert.equal(calls[0][2].headers,undefined);
      };
      component.afiliacionForm.controls.afiliacion.setValue('00123456789');
      validar();
      component.continuarAfiliacion();
      assert.equal(calls.length,1); // Solicitud ya en curso.
      response.next({success:true,comprobante:token,expiresIn:900});
      assert.equal(component.pasoActual,6);
      assert.equal(component.comprobanteAfiliacion,token);
      assert.deepEqual(component.referenciaAfiliacionPayload(),{});
      component.continuarAfiliacion();
      assert.equal(calls.length,1); // Reutiliza comprobante vigente.
      now += 900000;
      component.enviarPreRegistroCompleto(payload);
      assert.equal(component.pasoActual,0);
      assert.equal(calls.length,1); // No registra con comprobante vencido.
      assert.equal(component.comprobanteAfiliacion,'');
      validar();
      response.next({success:true,comprobante:token,expiresIn:30});
      assert.equal(component.comprobanteExpiraEn,now+30000); // Respeta vigencias menores.
      component.afiliacionForm.controls.afiliacion.setValue('2');
      assert.equal(component.comprobanteAfiliacion,'');
      validar();
      component.afiliacionForm.controls.afiliacion.setValue('3');
      component.afiliacionForm.controls.afiliacion.setValue('2');
      response.next({success:true,comprobante:token,expiresIn:900});
      assert.equal(component.comprobanteAfiliacion,''); // Respuesta A-B-A obsoleta.
      validar();
      response.error(new HttpErrorResponse({status:429,headers:new HttpHeaders({'Retry-After':'120'})}));
      component.continuarAfiliacion();
      assert.equal(calls.length,1);
      assert.match(component.errorAfiliacion,/120 segundos/);
      assert.equal(component.afiliacionForm.valid,true);
      now += 120000;
      validar();
      response.error(new HttpErrorResponse({status:404}));
      assert.match(component.errorAfiliacion,/404/);
      validar();
      response.next({success:true,comprobante:'invalid',expiresIn:900});
      assert.equal(component.comprobanteAfiliacion,'');
      validar();
      response.next({success:true,comprobante:token,expiresIn:900});
      const affiliationService = injector.get(ValidarAfiliacionService);
      for (const value of ['', 'a', '123456789012345678901', ' 123']) {
        let rejected = false;
        affiliationService.validarParaPreregistro(value).subscribe({error:()=>{rejected=true;}});
        assert.ok(rejected);
      }

      // Prueba documentos compartidos con la entidad y exclusión de nodos borrados.
      component.nodosCapturablesParaFlujo = () => [{id:'entidad-1',nombre:'Entidad'},{id:'sucursal-1',nombre:'Sucursal'}];
      Object.defineProperty(component,'mostrarArbolWizard',{get:()=>true});
      component.nodoFuenteDocumentosId = () => 'entidad-1';
      component.obtenerReglasDocumentos = () => [{numero:2,obligatorio:true}];
      component.documentosPorNodo = {'entidad-1':{2:{archivo:fileA}},eliminado:{2:{archivo:fileB}}};
      assert.deepEqual(component.prepararDocumentosParaBff().map(d=>d.nodoId),['entidad-1','sucursal-1']);
      component.documentosPorNodo['entidad-1'][2] = {archivoNombre:'perdido.pdf'};
      assert.throws(()=>component.prepararDocumentosParaBff(),/Vuelve a adjuntar/);
      component.prepararDocumentosParaBff = () => documentos;
      for (const respuesta of [{success:false},{}, {success:true}]) {
        response = new Subject(); calls = [];
        component.envioPreRegistroRealizado = false;
        component.registroTerminado = false;
        component.enviarPreRegistroCompleto(payload);
        component.finalizarRegistro();
        assert.equal(calls.length,1);
        assert.equal(calls[0][1].get('comprobante'),token);
        response.next(respuesta);
        assert.equal(component.registroTerminado,respuesta.success === true);
        component.finalizarRegistro();
        assert.equal(calls.length,1);
      }
      component.registroTerminado = false;
      response = new Subject(); calls = [];
      component.enviarPreRegistroCompleto(payload);
      response.error(new Error('Conexión perdida'));
      component.finalizarRegistro();
      assert.equal(calls.length,1);
      assert.match(component.errorEnvioPreRegistro,/Verifica|verifica/);
      Date.now = realNow;
      injector.destroy();
      console.log('OK: afiliación BFF sin nodeId, vigencia, invalidación, respuestas obsoletas, 429/404, cuatro tipos, multipart y orden, archivos ausentes/compartidos, sin Bearer, éxito estricto, errores y doble envío.');
    ` }, bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const path = join(temp, 'test.mjs');
  await writeFile(path, result.outputFiles[0].contents);
  await import(pathToFileURL(path).href);
} finally {
  await rm(temp, { recursive: true, force: true });
}
