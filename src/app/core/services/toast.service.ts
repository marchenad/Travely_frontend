import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(message: string, type: ToastType = 'info', duration = 4500): void {
    const id = this.nextId++;
    this.toasts.update((ts) => [...ts, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(msg: string): void { this.show(msg, 'success'); }
  error(msg: string): void   { this.show(msg, 'error', 6000); }
  warning(msg: string): void { this.show(msg, 'warning'); }
  info(msg: string): void    { this.show(msg, 'info'); }

  dismiss(id: number): void {
    this.toasts.update((ts) => ts.filter((t) => t.id !== id));
  }
}
