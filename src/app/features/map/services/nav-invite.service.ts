import { Injectable, DestroyRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, of } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';

import { VehicleService } from '../../../core/services/vehicle.service';
import { AuthService } from '../../../core/services/auth.service';
import { Vehicle } from '../../../shared/models/vehicle.model';

@Injectable()
export class NavInviteService {
  private readonly vehicleService = inject(VehicleService);
  private readonly authService    = inject(AuthService);

  readonly pending = signal<Vehicle | null>(null);

  private silenced     = new Map<number, number>();
  private initialized  = false;

  startPolling(destroyRef: DestroyRef, isNavigating: Signal<boolean>): void {
    interval(3000).pipe(
      startWith(0),
      switchMap(() => {
        const userId = this.authService.currentUser()?.userId;
        if (!userId) return of([]);
        return this.vehicleService.getByDriver(userId).pipe(catchError(() => of([])));
      }),
      takeUntilDestroyed(destroyRef),
    ).subscribe((vehicles: Vehicle[]) => {
      if (isNavigating()) return;
      if (this.pending() !== null) return;

      const userId = this.authService.currentUser()?.userId;
      if (!userId) return;

      if (!this.initialized) {
        for (const v of vehicles) {
          if (v.tripStatus === 'NAVIGATING' && v.tripCreatorId !== userId) {
            this.silenced.set(v.tripId, v.tripNavigationVersion ?? 0);
          }
        }
        this.initialized = true;
        return;
      }

      for (const v of vehicles) {
        if (v.tripStatus !== 'NAVIGATING' || v.tripCreatorId === userId) continue;
        const version = v.tripNavigationVersion ?? 0;
        const silenced = this.silenced.get(v.tripId) ?? -1;
        if (version > silenced) {
          this.silenced.set(v.tripId, version);
          this.pending.set(v);
          break;
        }
      }
    });
  }

  accept(): Vehicle | null {
    const invite = this.pending();
    this.pending.set(null);
    return invite;
  }

  reject(): void {
    this.pending.set(null);
  }
}
