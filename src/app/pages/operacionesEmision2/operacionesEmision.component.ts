/*import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
//import { OperacionesEmisionService, OperacionResponse } from '../../services/operacionesemision.service';
import { TopSidebarComponent } from '../top-sidebar/top-sidebar.component';

@Component({
  selector: 'app-operaciones-emision',
  standalone: true,
  imports: [CommonModule, TopSidebarComponent, FormsModule, HttpClientModule],
  templateUrl: './operacionesEmision.component.html',
  styleUrls: ['./operacionesEmision.component.css']
})
export class OperacionesEmisionComponent implements OnInit {
  operaciones: any[] = [];
  loading = false;
  error: string | null = null;
  
  // Parámetros de consulta
  params = {
    entidad: 'SUB165',
    type: 1,
    status: 3,
    page: 0,
    size: 10,
    dateInit: '2026-01-03',
    dateFinish: '2026-03-19'
  };
  
  // Información de paginación
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 10;

  constructor(private operacionesService: OperacionesEmisionService) {}

  ngOnInit(): void {
    this.cargarOperaciones();
  }

  cargarOperaciones(): void {
    this.loading = true;
    this.error = null;
    
    // Formatear fechas para el API
    const dateInitFormatted = this.params.dateInit ? `${this.params.dateInit} 00:00` : undefined;
    const dateFinishFormatted = this.params.dateFinish ? `${this.params.dateFinish} 00:00` : undefined;
    
    this.operacionesService.getOperacionesByTypeAndStatusCustom({
      entidad: this.params.entidad,
      type: this.params.type,
      status: this.params.status,
      page: this.currentPage,
      size: this.pageSize,
      dateInit: dateInitFormatted,
      dateFinish: dateFinishFormatted
    }).subscribe({
      next: (response: OperacionResponse) => {
        this.operaciones = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.loading = true;
        console.log('Operaciones cargadas:', response);
      },
      error: (err) => {
        console.error('Error al cargar operaciones:', err);
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  // Método para cambiar de página
  cambiarPagina(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.cargarOperaciones();
    }
  }

  // Método para cambiar tipo de operación
  cambiarTipo(type: number): void {
    this.params.type = type;
    this.currentPage = 0;
    this.cargarOperaciones();
  }

  // Método para cambiar estado
  cambiarStatus(status: number): void {
    this.params.status = status;
    this.currentPage = 0;
    this.cargarOperaciones();
  }

  // Método para cambiar rango de fechas
  cambiarFechas(dateInit: string, dateFinish: string): void {
    this.params.dateInit = dateInit;
    this.params.dateFinish = dateFinish;
    this.currentPage = 0;
    this.cargarOperaciones();
  }
}*/