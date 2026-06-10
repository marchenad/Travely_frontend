import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { VehicleService } from '../../../core/services/vehicle.service';
import { ToastService } from '../../../core/services/toast.service';
import { Vehicle } from '../../../shared/models/vehicle.model';
import { User } from '../../../shared/models/user.model';
import { Trip } from '../../../shared/models/trip.model';

@Injectable()
export class ParticipantService {
  private readonly vehicleService = inject(VehicleService);
  private readonly toast          = inject(ToastService);
  private readonly http           = inject(HttpClient);

  readonly foundUser     = signal<User | null>(null);
  readonly inviteLoading = signal(false);
  readonly inviteError   = signal('');
  readonly inviting      = signal(false);

  searchUser(email: string): void {
    const trimmed = email.trim();
    if (!trimmed) return;
    this.inviteLoading.set(true);
    this.inviteError.set('');
    this.foundUser.set(null);

    this.http.get<User>(`${environment.apiUrl}/users/search?email=${encodeURIComponent(trimmed)}`)
      .subscribe({
        next: (user) => { this.foundUser.set(user); this.inviteLoading.set(false); },
        error: () => {
          this.inviteError.set('No se encontró ningún usuario con ese correo');
          this.inviteLoading.set(false);
        },
      });
  }

  isAlreadyInTrip(userId: number, vehicles: Vehicle[]): boolean {
    return vehicles.some((v) => v.driverId === userId);
  }

  invite(trip: Trip, user: User, vehicles: Vehicle[]): Promise<Vehicle> {
    if (this.isAlreadyInTrip(user.id, vehicles)) {
      this.inviteError.set('Este usuario ya está en el viaje');
      return Promise.reject('duplicate');
    }
    this.inviting.set(true);
    return new Promise((resolve, reject) => {
      this.vehicleService.create({
        name: user.name, licensePlate: '', driverId: user.id, tripId: trip.id,
      }).subscribe({
        next: (v) => { this.inviting.set(false); resolve(v); },
        error: () => {
          this.inviting.set(false);
          this.toast.error('No se pudo añadir al participante. Inténtalo de nuevo.');
          reject();
        },
      });
    });
  }

  remove(vehicleId: number, onSuccess: () => void): void {
    this.vehicleService.delete(vehicleId).subscribe({
      next: onSuccess,
      error: () => this.toast.error('No se pudo eliminar al participante.'),
    });
  }

  reset(): void {
    this.foundUser.set(null);
    this.inviteError.set('');
  }
}
