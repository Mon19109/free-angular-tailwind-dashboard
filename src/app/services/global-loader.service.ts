import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalLoaderService {
  private activeRequests = 0;
  readonly visible = signal(false);

  show(): void {
    this.activeRequests += 1;
    this.visible.set(true);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.visible.set(this.activeRequests > 0);
  }

  reset(): void {
    this.activeRequests = 0;
    this.visible.set(false);
  }
}
