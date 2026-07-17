import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

export interface TipoNegocio {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  iconoInferior: string;
  nivel: string;
  tipoComercio: string;
  beneficios: string[];
}

@Component({
  selector: 'app-tipos-negocio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tipos-negocio.component.html',
  styleUrls: ['./tipos-negocio.component.css'],
})
export class TiposNegocioComponent {
  @Output() seleccionar = new EventEmitter<TipoNegocio>();

  readonly tiposNegocio: TipoNegocio[] = [
    {
      id: 'comercio-unico',
      titulo: 'Comercio único',
      descripcion: 'Aplica para un comercio con una sola sucursal.',
      icono: 'fa-store',
      iconoInferior: 'fa-user',
      nivel: 'Sucursal',
      tipoComercio: 'Sucursales Únicas',
      beneficios: [
        'Un usuario Administrador de Portal para Gestión de Recursos.',
        'Un usuario para operar las TPV en cajas.',
      ],
    },
    {
      id: 'sucursales-multiples',
      titulo: 'Sucursales múltiples',
      descripcion: 'Aplica para una empresa con múltiples sucursales que pueden tener los mismos datos fiscales o diferentes.',
      icono: 'fa-shop',
      iconoInferior: 'fa-users',
      nivel: 'Sucursal',
      tipoComercio: 'Sucursales de Grupo',
      beneficios: [
        'Un usuario Administrador de Portal para Gestión del negocio, recursos y reportes de todas las sucursales.',
        'Usuario Administrador para cada sucursal.',
        'De un usuario hasta N para operar las terminales en cajas.',
      ],
    },
    {
      id: 'empresa-holding',
      titulo: 'Empresa holding',
      descripcion: 'Aplica para una empresa con múltiples negocios y giros comerciales que pueden tener los mismos datos fiscales o diferentes.',
      icono: 'fa-building',
      iconoInferior: 'fa-crown',
      nivel: 'Sub Afiliado',
      tipoComercio: 'Empresa Holding',
      beneficios: [
        'Un usuario Administrador de Portal para Gestión de cada negocio y reportes generales.',
        'Usuario Administrador para cada sucursal.',
        'De un usuario hasta N para operar las terminales en cajas.',
      ],
    },
    {
      id: 'auditor-unico',
      titulo: 'Sucursales múltiples un solo auditor',
      descripcion: 'Centraliza la supervisión de recursos, reportes y administración de sucursales bajo un auditor principal.',
      icono: '',
      iconoInferior: 'fa-shield-halved',
      nivel: 'Entidad',
      tipoComercio: 'Empresa Grupo',
      beneficios: [
        'Un usuario Administrador de Portal para Gestión del negocio, recursos y reportes de todas las sucursales.',
        'Usuario Administrador para cada sucursal.',
        'De un usuario hasta N para operar las terminales en cajas.',
      ],
    },
  ];

  seleccionarTipo(tipo: TipoNegocio): void {
    this.seleccionar.emit(tipo);
  }
}
