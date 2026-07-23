import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

export interface TipoNegocio {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  imagen: string;
  iconoInferior: string;
  imagenInferior: string;
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
      descripcion: 'Aplica para un comercio con una sola sucursal y una caja numérica.',
      icono: 'fa-store',
      imagen: 'assets/paquetes/comercio.png',
      iconoInferior: 'fa-user',
      imagenInferior: 'assets/paquetes/usuario.png',
      nivel: 'Sucursal',
      tipoComercio: 'Sucursales Únicas',
      beneficios: [
        'Sucursal única.',
        'Caja numérica única.',
      ],
    },
    {
      id: 'sucursales-multiples',
      titulo: 'Sucursales múltiples',
      descripcion: 'Aplica para una empresa con múltiples sucursales que pueden tener los mismos datos fiscales o pueden ser diferentes.',
      icono: 'fa-shop',
      imagen: 'assets/paquetes/sucursales.png',
      iconoInferior: 'fa-users',
      imagenInferior: 'assets/paquetes/grupo.png',
      nivel: 'Sucursal',
      tipoComercio: 'Sucursales de Grupo',
      beneficios: [
        'N sucursales.',
        'N cajas numéricas.',
      ],
    },
    {
      id: 'empresa-holding',
      titulo: 'Empresa holding',
      descripcion: 'Aplica para una empresa con múltiples negocios y giros comerciales que pueden tener los mismos datos fiscales o pueden ser diferentes.',
      icono: 'fa-building',
      imagen: 'assets/paquetes/empresa.png',
      iconoInferior: 'fa-crown',
      imagenInferior: 'assets/paquetes/corona.png',
      nivel: 'Sub Afiliado',
      tipoComercio: 'Empresa Holding',
      beneficios: [
        'N entidades.',
        'N sucursales.',
        'N cajas.',
      ],
    },
    {
      id: 'auditor-unico',
      titulo: 'Sucursales múltiples un solo auditor',
      descripcion: 'Un usuario  Administrador de Portal para Gestion del negocio. Administrador de Recursos. Consulta de Reportes de todas las sucursales.',
      icono: '',
      imagen: 'assets/paquetes/auditor.png',
      iconoInferior: 'fa-shield-halved',
      imagenInferior: 'assets/paquetes/seguridad.png',
      nivel: 'Entidad',
      tipoComercio: 'Empresa Grupo',
      beneficios: [
        'N sucursales.',
        'N cajas numéricas.',
      ],
    },
  ];

  seleccionarTipo(tipo: TipoNegocio): void {
    this.seleccionar.emit(tipo);
  }
}
