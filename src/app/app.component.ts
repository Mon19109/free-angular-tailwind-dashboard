import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionTimeoutService } from './services/session-timeout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly sessionTimeoutService = inject(SessionTimeoutService);

  title = 'Kashpay';

  ngOnInit(): void {
    this.sessionTimeoutService.iniciar();
  }
}
