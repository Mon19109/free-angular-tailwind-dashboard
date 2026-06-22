// src/app/modals/formulario-modal.component.ts
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-formulario-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-box">
      <!-- Encabezado del modal -->
      <h3 class="font-bold text-lg mb-4">{{ titulo || 'Formulario' }}</h3>
      
      <!-- Formulario reactivo -->
      <form [formGroup]="formulario" (ngSubmit)="enviar()">
        <!-- Campo: Nombre -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Nombre</label>
          <input 
            type="text"
            formControlName="nombre"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ingresa tu nombre"
          />
          <p *ngIf="formulario.get('nombre')?.invalid && formulario.get('nombre')?.touched" 
             class="text-red-500 text-sm mt-1">
            El nombre es obligatorio
          </p>
        </div>

        <!-- Campo: Email -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Correo electrónico</label>
          <input 
            type="email"
            formControlName="email"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="correo@ejemplo.com"
          />
          <p *ngIf="formulario.get('email')?.invalid && formulario.get('email')?.touched" 
             class="text-red-500 text-sm mt-1">
            Ingresa un email válido
          </p>
        </div>

        <!-- Campo: Mensaje (textarea) -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Mensaje</label>
          <textarea 
            formControlName="mensaje"
            rows="3"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Escribe tu mensaje aquí..."
          ></textarea>
        </div>

        <!-- Botones de acción -->
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" (click)="cerrar()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="formulario.invalid">
            Enviar
          </button>
        </div>
      </form>
    </div>
  `
})
export class FormularioModalComponent {
  private fb = inject(FormBuilder);
  
  // Datos que se reciben desde el componente que abre el modal
  @Input() titulo = '';
  @Output() closed = new EventEmitter<void>();
  
  // Definir el formulario reactivo
  formulario: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    mensaje: ['']
  });

  // Método para cerrar el modal sin enviar
  cerrar() {
    this.closed.emit();
  }

  // Método que se ejecuta al enviar el formulario
  enviar() {
    if (this.formulario.valid) {
      // Aquí puedes procesar los datos (enviar a API, guardar en servicio, etc.)
      console.log('Datos del formulario:', this.formulario.value);
      this.closed.emit();
    }
  }
}
