import { Component,signal,inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserSessionData } from '../../services/auth.service';
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

  user: UserSessionData | null = null;
  private  dashService = inject(DashboardService);


  constructor(
    private fb: FormBuilder
  ){}
  
  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    // Cargar balance sirio
console.log('user?'+this.user?.userName);
    this.dashService.getBalanceSirio().subscribe({
      next:  (response: any) => {
        // Acceder a catOperationTypes dentro de la respuesta
        //this.balanceSirio = response;       
        //this.balanceSirio = Array.isArray(response) ? response : [response];
        //this.balanceSirio = response || [];
        //this.balanceSirio = Array.isArray(response) ? response : [response];
        //this.balanceSirio = this.balanceSirio || [];

        /*this.balanceSirio = [
        { id: 1, concepto: 'Balance Principal', monto: 15000.50, moneda: 'MXN', fecha: '2024-01-15' },
        { id: 2, concepto: 'Balance Secundario', monto: 5000.00, moneda: 'MXN', fecha: '2024-01-15' },
        { id: 3, concepto: 'Comisiones', monto: 250.75, moneda: 'MXN', fecha: '2024-01-15' }
      ];*/
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


