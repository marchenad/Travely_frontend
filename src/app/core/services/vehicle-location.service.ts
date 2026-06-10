import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  VehicleLocation,
  VehicleLocationRequest,
} from '../../shared/models/vehicle-location.model';

@Injectable({ providedIn: 'root' })
export class VehicleLocationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}`;

  getLatestByVehicle(vehicleId: number): Observable<VehicleLocation> {
    return this.http.get<VehicleLocation>(
      `${this.url}/vehicles/${vehicleId}/location`
    );
  }

  getLatestByTrip(tripId: number): Observable<VehicleLocation[]> {
    return this.http.get<VehicleLocation[]>(
      `${this.url}/trips/${tripId}/locations`
    );
  }

  updateLocation(
    vehicleId: number,
    data: VehicleLocationRequest
  ): Observable<VehicleLocation> {
    return this.http.post<VehicleLocation>(
      `${this.url}/vehicles/${vehicleId}/location`,
      data
    );
  }
}
