import { Routes } from '@angular/router';
import { EcommerceComponent } from './pages/dashboard2/ecommerce/ecommerce.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { FormElementsComponent } from './pages/forms/form-elements/form-elements.component';
import { BasicTablesComponent } from './pages/tables/basic-tables/basic-tables.component';
import { BlankComponent } from './pages/blank/blank.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { InvoicesComponent } from './pages/invoices/invoices.component';
import { LineChartComponent } from './pages/charts/line-chart/line-chart.component';
import { BarChartComponent } from './pages/charts/bar-chart/bar-chart.component';
import { AlertsComponent } from './pages/ui-elements/alerts/alerts.component';
import { AvatarElementComponent } from './pages/ui-elements/avatar-element/avatar-element.component';
import { BadgesComponent } from './pages/ui-elements/badges/badges.component';
import { ButtonsComponent } from './pages/ui-elements/buttons/buttons.component';
import { ImagesComponent } from './pages/ui-elements/images/images.component';
import { VideosComponent } from './pages/ui-elements/videos/videos.component';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { SignUpComponent } from './pages/auth-pages/sign-up/sign-up.component';
import { CalenderComponent } from './pages/calender/calender.component';

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
import { AddLinkPagoComponent } from './pages/addLinkPago/addLinkPago.component';
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
    path:'',
    component:AppLayoutComponent,
    children:[
      {
        path: 'ecommerce',
        component: EcommerceComponent,
        title:
          'Angular Ecommerce Dashboard | TailAdmin - Angular Admin Dashboard Template',
      },
      {
        path: 'saldos',
        component: SaldosComponent,
        canActivate: [AuthGuard],
        title: 'KASHPAY'
      },
      
      {
        path:'calendar',
        component:CalenderComponent,
        title:'Angular Calender | TailAdmin - Angular Admin Dashboard Template'
      },
      /*{
        path:'usuarios',
        component:ProfileComponent,
        title:'Angular Profile Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },*/
      {
        path:'form-elements',
        component:FormElementsComponent,
        title:'Angular Form Elements Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'basic-tables',
        component:BasicTablesComponent,
        title:'Angular Basic Tables Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'blank',
        component:BlankComponent,
        title:'Angular Blank Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      // support tickets
      {
        path:'invoice',
        component:InvoicesComponent,
        title:'Angular Invoice Details Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'line-chart',
        component:LineChartComponent,
        title:'Angular Line Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'bar-chart',
        component:BarChartComponent,
        title:'Angular Bar Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'alerts',
        component:AlertsComponent,
        title:'Angular Alerts Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'avatars',
        component:AvatarElementComponent,
        title:'Angular Avatars Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'badge',
        component:BadgesComponent,
        title:'Angular Badges Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'buttons',
        component:ButtonsComponent,
        title:'Angular Buttons Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'images',
        component:ImagesComponent,
        title:'Angular Images Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'videos',
        component:VideosComponent,
        title:'Angular Videos Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      // auth pages
      {
        path:'signin',
        component:SignInComponent,
      title:'KASHPAY'
      },
      {
        path:'signup',
        component:SignUpComponent,
        title:'KASHPAY'
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
  path: 'operaciones_emision',
  component: OperacionesEmisionComponent,
  canActivate: [AuthGuard],
  title:'KASHPAY'
},
      { 
        path: 'operaciones_adquirencia', 
        component: OperacionesAdquirenciaComponent, 
        canActivate: [AuthGuard] 
      },
      { 
        path: 'transacciones_emision', 
        component: TransaccionesEmisionComponent, 
        canActivate: [AuthGuard] 
      },
      { 
        path: 'transacciones_adquirencia', 
        component: TransaccionesAdquirenciaComponent, 
        canActivate: [AuthGuard] 
      },
      { 
        path: 'tarjeta', 
        component: TarjetaComponent, 
        canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'pago_distancia', 
        component: PagoDistanciaComponent, 
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'add_linkpago', 
        component: AddLinkPagoComponent, 
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },
      { 
        path: 'pagar_linkpago', 
        component: PagarLinkPagoComponent, 
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },

{ 
        path: 'orden_pago', 
        component: OrdenPagoComponent, 
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },

      {
        path: 'beneficiarios',
        component: BeneficiariosComponent,
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },

      {
        path: 'manuales',
        component: ManualesComponent,
        //canActivate: [AuthGuard],
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
        //canActivate: [AuthGuard],
        title:'KASHPAY'
      },



      
      // error pages
      {
        path:'**',
        component:NotFoundComponent,
        title:'KASHPAY'
      },
    ]
  },
];
