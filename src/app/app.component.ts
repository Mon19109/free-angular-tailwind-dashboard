import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationLoaderService } from './services/navigation-loader.service';
import { SessionTimeoutService } from './services/session-timeout.service';
import { GlobalLoaderComponent } from './shared/components/global-loader/global-loader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    GlobalLoaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly sessionTimeoutService = inject(SessionTimeoutService);

  title = 'Kashpay';

  constructor() {
    const loader = inject(NavigationLoaderService);
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) loader.start(event.id);
      else if (event instanceof NavigationEnd) loader.end(event.id);
      else if (event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) {
        loader.cancel(event.id);
      }
    });
  }

  ngOnInit(): void {
    this.sessionTimeoutService.iniciar();
  }
}
