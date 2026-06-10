import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="alert">
          <span class="toast__icon">
            @switch (toast.type) {
              @case ('success') { ✓ }
              @case ('error')   { ✗ }
              @case ('warning') { ⚠ }
              @default          { ℹ }
            }
          </span>
          <span class="toast__msg">{{ toast.message }}</span>
          <button class="toast__close" (click)="toastService.dismiss(toast.id)" aria-label="Cerrar">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 340px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      color: #fff;
      box-shadow: 0 4px 18px rgba(0,0,0,.18);
      pointer-events: all;
      animation: slideIn .22s ease;
      line-height: 1.4;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(30px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .toast--success { background: #16a34a; }
    .toast--error   { background: #dc2626; }
    .toast--warning { background: #d97706; }
    .toast--info    { background: #4f46e5; }

    .toast__icon {
      font-size: 15px;
      flex-shrink: 0;
      width: 18px;
      text-align: center;
    }

    .toast__msg  { flex: 1; }

    .toast__close {
      background: none;
      border: none;
      color: rgba(255,255,255,.75);
      font-size: 18px;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
      flex-shrink: 0;
      transition: color .15s;
    }
    .toast__close:hover { color: #fff; }
  `],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
