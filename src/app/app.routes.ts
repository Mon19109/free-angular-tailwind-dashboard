import { DetalleOperacionComponent } from './pages/detalleOperacion/detalle-operacion.component';
import { agregarNivelComercioGuard } from './guards/agregar-nivel-comercio.guard';
import { dashboardPreregistroClientesGuard } from './guards/dashboard-preregistro-clientes.guard';
import { enviarInvitacionComercioGuard } from './guards/enviar-invitacion-comercio.guard';
import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';

import { LoginComponent } from '../app/pages/login/login.component';
import { AuthGuard } from '../app/guards/auth.guard';

// Importar componentes de páginas
import { DashboardComponent } from '../app/pages/dashboard/dashboard.component';
import { UsuariosComponent } from '../app/pages/usuarios/usuarios.component';
import { OperacionesEmisionComponent } from '../app/pages/operacionesEmision/operacionesEmision.component';
import { TransaccionesEmisionComponent } from '../app/pages/transaccionesEmision/transaccionesEmision.component';
import { TransaccionesAdquirenciaComponent } from '../app/pages/transaccionesAdquirencia/transaccionesAdquirencia.component';
import { OperacionesAdquirenciaComponent } from '../app/pages/operacionesAdquirencia/operacionesAdquirencia.component';
import { TarjetaComponent } from '../app/pages/tarjeta/tarjeta.component';
import { PagoDistanciaComponent } from '../app/pages/pagoDistancia/pagoDistancia.component';
import { DetalleLinkPagoComponent } from './pages/detalleLinkpago/detalleLinkpago.component';
import { NuevoLinkPagoComponent } from './pages/nuevoLinkPago/nuevoLinkPago.component';
import { AddBotonPagoComponent } from './pages/addBotonPago/addBotonPago.component';
import { AddLinkPagoComponent } from './pages/addLinkPago/addLinkPago.component';
import { LinkNegocioComponent } from './pages/linkNegocio/linkNegocio.component';
import { SaldosComponent } from '../app/pages/saldos/saldos.component';
import { PagarLinkPagoComponent } from '../app/pages/pagarLinkPago/pagarLinkPago.component';
import { OrdenPagoComponent } from './pages/OrdenPago/OrdenPago.component';
import { PreRegistroComponent } from './pages/preRegistro/preRegistro.component';
import { ManualesComponent } from './pages/manuales/manuales.component';
import { InformacionCuentaComponent } from './pages/informacionCuenta/informacionCuenta.component';
import { CajasComponent } from './pages/cajas/cajas.component';
import { EstadoCuentaComponent } from './pages/estadoCuenta/estadoCuenta.component';
import { SucursalesComponent } from './pages/sucursales/sucursales.component';
import { ListarComerciosComponent } from './pages/listarComercios/listarComercios.component';
import { BeneficiariosComponent } from './pages/beneficiarios/beneficiarios.component';
import { RevisionMesaDigitalComponent } from './pages/revisionMesaDigital/revisionMesaDigital.component';
import { EnviarInvitacionComercioComponent } from './pages/enviarInvitacionComercio/enviarInvitacionComercio.component';
import { ConsultaComerciosComponent } from './pages/consultaComercios/consultaComercios.component';
import { DashboardPreregistroClientesComponent } from './pages/dashboardPreregistroClientes/dashboardPreregistroClientes.component';
import { RegistroAfiliacionComponent } from './pages/registroAfiliacion/registroAfiliacion.component';
import { AgregarNivelComercioComponent } from './pages/agregarNivelComercio/agregarNivelComercio.component';
import { RegistroClienteComponent } from './pages/registroCliente/registroCliente.component';
import { RegistroProspectoClienteComponent } from './pages/registroProspectoCliente/registroProspectoCliente.component';
import { ReportesComponent } from './pages/reportes/reportes.component';
import { VoucherComponent } from './pages/voucher/voucher.component';
import { RecuperarCuentaComponent } from './pages/recuperarCuenta/recuperarCuenta.component';
import { EdiarInformacionComponent } from './pages/ediarInformacion/ediarInformacion.component';
import { AclaracionesComponent } from './pages/aclaraciones/aclaraciones.component';

export function prospectoTokenMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length !== 1) return null;
  const token = segments[0].path;
  if (token.length < 80 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return {
    consumed: segments,
    posParams: {
      link: segments[0]
    }
  };
}

export function miAngularProspectoMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length !== 2 || segments[0].path !== 'seguimiento') return null;
  const token = segments[1].path;
  if (token.length < 80 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return {
    consumed: segments,
    posParams: {
      link: segments[1]
    }
  };
}

export const routes: Routes = [
  { 
    path: '', 
    component: LoginComponent,
    title:'KASHPAY' ,
    pathMatch: 'full'
  },
  {
    path: 'preregistro',
    component: PreRegistroComponent,
    title: 'Pre registro | KASHPAY'
  },
  {
    path: 'recuperarCuenta',
    component: RecuperarCuentaComponent,
    title: 'Recuperar cuenta | KASHPAY'
  },
  {
    path: 'registro-prospecto',
    component: RegistroProspectoClienteComponent,
    title: 'Registro de prospecto | KASHPAY'
  },
  {
    path: 'registro-prospecto/:link',
    component: RegistroProspectoClienteComponent,
    title: 'Registro de prospecto | KASHPAY'
  },
  {
    matcher: miAngularProspectoMatcher,
    component: RegistroProspectoClienteComponent,
    title: 'Registro de prospecto | KASHPAY'
  },
  {
    path: 'seguimiento',
    component: RegistroProspectoClienteComponent,
    pathMatch: 'full'
  },
  {
    path: 'seguimiento/:link',
    component: RegistroProspectoClienteComponent,
    pathMatch: 'full'
  },
  {
    matcher: prospectoTokenMatcher,
    component: RegistroProspectoClienteComponent,
    title: 'Registro de prospecto | KASHPAY'
  },
  { 
    path: 'pagar_linkpago', 
    component: PagarLinkPagoComponent, 
    //canActivate: [AuthGuard],
    title:'KASHPAY'
  },
  {
    path: 'paymentLink',
    component: PagarLinkPagoComponent,
    title: 'KASHPAY'
  },
  { 
    path: 'voucher', 
    component: VoucherComponent, 
    //canActivate: [AuthGuard],
    title:'KASHPAY'
  },
  { 
    path: 'linkNegocio', 
    component: LinkNegocioComponent, 
    //canActivate: [AuthGuard],
    title:'KASHPAY'
  },
  {
    path:'',
    component:AppLayoutComponent,
    canActivateChild: [AuthGuard],
    data: { sessionTimeout: true },
    children:[
      {
        path: 'saldos',
        component: SaldosComponent,
        canActivate: [AuthGuard],
        title: 'KASHPAY'
      },      
      { 
        path: 'dashboard', 
        component:DashboardComponent, 
        canActivate: [AuthGuard] ,
        title:'KASHPAY'
      },
      { 
        path: 'usuarios', 
        component: UsuariosComponent, 
        canActivate: [AuthGuard] ,
        title:'KASHPAY'
      },
      {
        path: 'detalleOperacion',
        component: DetalleOperacionComponent,
        canActivate: [AuthGuard],
        title: 'Detalle de liquidación'
      },
      {
        path: 'operaciones_emision',
        component: OperacionesEmisionComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'operaciones_adquirencia', 
        component: OperacionesAdquirenciaComponent, 
        canActivate: [AuthGuard] ,
        title:'KASHPAY'
      },
      {
        path: 'aclaraciones',
        component: AclaracionesComponent,
        canActivate: [AuthGuard],
        title: 'KASHPAY'
      },
      { 
        path: 'transacciones_emision', 
        component: TransaccionesEmisionComponent, 
        canActivate: [AuthGuard] ,
        title:'KASHPAY'
      },
      { 
        path: 'transacciones_adquirencia', 
        component: TransaccionesAdquirenciaComponent, 
        canActivate: [AuthGuard] ,
        title:'KASHPAY'
      },
      { 
        path: 'tarjeta', 
        component: TarjetaComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'reportes', 
        component: ReportesComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'pago_distancia', 
        component: PagoDistanciaComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'detalleLinkpago',
        component: DetalleLinkPagoComponent,
        canActivate: [AuthGuard],
        title: 'KASHPAY'
      },
      {
        path: 'nuevoLinkPago',
        component: NuevoLinkPagoComponent,
        //canActivate: [AuthGuard],
        title: 'KASHPAY'
      },
      {
        path: 'add_linkpago',
        component: AddLinkPagoComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'add_botonpago', 
        component: AddBotonPagoComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'orden_pago', 
        component: OrdenPagoComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'beneficiarios',
        component: BeneficiariosComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },

      {
        path: 'enviar_invitacion_comercio',
        component: EnviarInvitacionComercioComponent,
        canActivate: [AuthGuard, enviarInvitacionComercioGuard],
        title:'KASHPAY'
      },

      {
        path: 'manuales',
        component: ManualesComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },

      {
        path: 'revision_mesa_digital',
        component: RevisionMesaDigitalComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'informacion_cuenta',
        component: InformacionCuentaComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'consulta_comercios',
        component: ConsultaComerciosComponent,
        data: { roles: [2, 3, 4, 5, 6] },
        title: 'KASHPAY'
      },
      {
        path: 'dashboard_preregistro_clientes',
        component: DashboardPreregistroClientesComponent,
        canActivate: [dashboardPreregistroClientesGuard],
        data: { roles: [2] },
        title: 'Dashboard Preregistro Clientes | KASHPAY'
      },
      {
       path: 'registro_afiliacion',
       component: RegistroAfiliacionComponent,
       canActivate: [dashboardPreregistroClientesGuard],
       data: { roles: [2] },
       title: 'Registro Afiliación | KASHPAY'
       },
      {
        path: 'agregar_nivel_comercio',
        component: AgregarNivelComercioComponent,
        canActivate: [agregarNivelComercioGuard],
        title:'KASHPAY'
      },
      {
        path: 'registro_cliente',
        component: RegistroClienteComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'entidades',
        component: ListarComerciosComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'sucursales',
        component: SucursalesComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'cajas',
        component: CajasComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'estado_cuenta',
        component: EstadoCuentaComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      {
        path: 'ediarInformacion',
        component: EdiarInformacionComponent,
        canActivate: [AuthGuard],
        title:'KASHPAY'
      }
    ]
  },
  // error pages
  {
    path:'**',
    component:NotFoundComponent,
    title:'KASHPAY'
  }
];
