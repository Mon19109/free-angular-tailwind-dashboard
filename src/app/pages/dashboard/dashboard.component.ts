import { Component,signal,inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
//import { AuthService, UserSessionData } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',  
  styleUrls: ['./dashboard.component.css']   
})
export class DashboardComponent {
  balanceAlde = signal<any[]>([]);
  balanceSirio = signal<any[]>([]);
  balanceAhorro = signal<any[]>([]);
  reportes = signal<any[]>([]);
  session: any = {};

  //user: UserSessionData | null = null;
  private  dashService = inject(DashboardService);


  constructor(
    private fb: FormBuilder
  ){}
  
  ngOnInit(): void {
    this.session = this.getSession();
    console.log('[Dashboard debug] auth_session sin token:', this.omitSensitive(this.session));
    console.log('[Dashboard debug] claves utiles localStorage:', {
      issueId: localStorage.getItem('issueId'),
      acquiringId: localStorage.getItem('acquiringId'),
      entitySonID: localStorage.getItem('entitySonID'),
      commerceDetailID: localStorage.getItem('commerceDetailID'),
      nodeID: localStorage.getItem('nodeID'),
      idBusinessModel: localStorage.getItem('idBusinessModel'),
      idTypeAffiliation: localStorage.getItem('idTypeAffiliation'),
      idRol: localStorage.getItem('idRol')
    });
    this.cargarDatosIniciales();
  }

  private getSession(): any {
    const rawSession = localStorage.getItem('auth_session');
    return rawSession ? JSON.parse(rawSession) : {};
  }

  private omitSensitive(value: any): any {
    if (Array.isArray(value)) {
      return value.map(item => this.omitSensitive(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.keys(value).reduce((safe: any, key) => {
      const lowerKey = key.toLowerCase();
      safe[key] = lowerKey.includes('token') || lowerKey.includes('password')
        ? '[oculto]'
        : this.omitSensitive(value[key]);
      return safe;
    }, {});
  }

  get idBusinessModel(): number {
    return Number(this.session?.idBusinessModel || 0);
  }

  get hasReserve(): boolean {
    return !!this.session?.reserveId;
  }

  get showEmision(): boolean {
    return this.idBusinessModel !== 2;
  }

  get showAdquirencia(): boolean {
    return this.idBusinessModel !== 1;
  }

  get showReserve(): boolean {
    return this.hasReserve;
  }

  money(value: any): string {
    const amount = Number(value || 0);
    return amount.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN'
    });
  }

  cargarDatosIniciales(): void {
    // Cargar balance sirio
    //console.log('user?'+this.user?.userName);
    this.dashService.getBalanceSirio().subscribe({
      next:  (response: any) => {

        let datos: any[] = [];
        
        if (Array.isArray(response)) {
          datos = response;
        } else if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            datos = response.data;
          } else if (response.result && Array.isArray(response.result)) {
            datos = response.result;
          } else {
            datos = [response];
          }
        }
        
        console.log('Datos a asignar:', datos);
        
        // Asignar usando signal
        this.balanceSirio.set(datos);
        
        console.log('Signal actualizada:', this.balanceSirio());
      },
      error: (error) => {
        console.error('Error al cargar balance de sirio:', error);
        //this.balanceSirio = [];
      }
    });

     this.dashService.getBalanceAhorro().subscribe({
      next:  (response: any) => {
        let datos: any[] = [];
        
        if (Array.isArray(response)) {
          datos = response;
        } else if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            datos = response.data;
          } else if (response.result && Array.isArray(response.result)) {
            datos = response.result;
          } else {
            datos = [response];
          }
        }
        
        console.log('Datos a asignar:', datos);
        
        // Asignar usando signal
        this.balanceAhorro.set(datos);
        
        console.log('Signal actualizada Ahorro:', this.balanceAhorro());
      },
      error: (error) => {
        console.error('Error al cargar balance de ahorro:', error);
        this.balanceAhorro.set([]);
      }
    });

    // Cargar aldebaran balance
    this.dashService.getBalanceAldebaran().subscribe({
      next: (response) => {
        
        let datos: any[] = [];
        
        if (Array.isArray(response)) {
          datos = response;
        } else if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            datos = response.data;
          } else if (response.result && Array.isArray(response.result)) {
            datos = response.result;
          } else {
            datos = [response];
          }
        }
        
        console.log('Datos a asignar Aldebaran:', datos);
        
        // Asignar usando signal
        this.balanceAlde.set(datos);
        
        console.log('Signal actualizada Aldebaran:', this.balanceAlde());
      },
      error: (error) => {
        console.error('Error al cargar balance de Aldebaran:', error);
      }
    });


    this.dashService.getReport().subscribe({
      next: (response) => {
        
        let datos: any[] = [];
        
        if (Array.isArray(response)) {
          datos = response;
        } else if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            datos = response.data;
          } else if (response.result && Array.isArray(response.result)) {
            datos = response.result;
          } else {
            datos = [response];
          }
        }
        
        console.log('Datos a asignar Reportes:', datos);
        
        // Asignar usando signal
        this.reportes.set(datos);
        
        console.log('Signal actualizada Reportes:', this.reportes());
      },
      error: (error) => {
        console.error('Error al cargar reportes:', error);
      }
    });
  }

  
}
