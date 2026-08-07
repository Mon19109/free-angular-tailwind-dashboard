import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlobalLoaderService } from '../../../services/global-loader.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-loader.component.html',
  styleUrl: './global-loader.component.css'
})
export class GlobalLoaderComponent {
  readonly loaderService = inject(GlobalLoaderService);
  readonly logoSrc = 'https://portal-antares.kashplataforma.com/public/assets/img/logo_kashpay_sobra.png';
}
