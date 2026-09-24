import { Injectable, inject } from '@angular/core';
import { GlobalLoaderService } from './global-loader.service';

/** Keeps the module cover until navigation and its initial HTTP requests finish. */
@Injectable({ providedIn: 'root' })
export class NavigationLoaderService {
  private readonly loader = inject(GlobalLoaderService);
  private navigationId: number | null = null;
  private pendingRequests = 0;
  private navigationEnded = false;
  private frame: number | null = null;

  start(id: number): void {
    this.cancelFrame();
    if (this.navigationId === null) this.loader.show();
    this.navigationId = id;
    this.pendingRequests = 0;
    this.navigationEnded = false;
  }

  end(id: number): void {
    if (id !== this.navigationId) return;
    this.navigationEnded = true;
    this.finishAfterRender();
  }

  cancel(id: number): void {
    if (id !== this.navigationId) return;
    this.cancelFrame();
    this.navigationId = null;
    this.loader.hide();
  }

  trackRequest(): () => void {
    const id = this.navigationId;
    if (id === null) return () => {};
    this.cancelFrame();
    this.pendingRequests += 1;
    return () => {
      if (id !== this.navigationId) return;
      this.pendingRequests -= 1;
      this.finishAfterRender();
    };
  }

  private finishAfterRender(): void {
    if (!this.navigationEnded || this.pendingRequests || this.navigationId === null) return;
    this.cancelFrame();
    // Let the routed view initialize and paint, including chained initial requests.
    this.frame = requestAnimationFrame(() => {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (this.pendingRequests === 0 && this.navigationId !== null) {
          this.navigationId = null;
          this.loader.hide();
        }
      });
    });
  }

  private cancelFrame(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
