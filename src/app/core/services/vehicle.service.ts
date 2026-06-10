import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Vehicle, VehicleRequest } from '../../shared/models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/vehicles`;

  getAll(tripId?: number): Observable<Vehicle[]> {
    const params = tripId
      ? new HttpParams().set('tripId', tripId)
      : undefined;
    return this.http.get<Vehicle[]>(this.url, { params });
  }

  getByDriver(driverId: number): Observable<Vehicle[]> {
    const params = new HttpParams().set('driverId', driverId);
    return this.http.get<Vehicle[]>(this.url, { params });
  }

  getById(id: number): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.url}/${id}`);
  }

  create(data: VehicleRequest): Observable<Vehicle> {
    return this.http.post<Vehicle>(this.url, data);
  }

  update(id: number, data: VehicleRequest): Observable<Vehicle> {
    return this.http.put<Vehicle>(`${this.url}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
