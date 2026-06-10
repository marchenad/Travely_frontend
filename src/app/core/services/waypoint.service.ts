import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Waypoint, WaypointRequest } from '../../shared/models/waypoint.model';

@Injectable({ providedIn: 'root' })
export class WaypointService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}`;

  getByTrip(tripId: number): Observable<Waypoint[]> {
    return this.http.get<Waypoint[]>(`${this.url}/trips/${tripId}/waypoints`);
  }

  getById(id: number): Observable<Waypoint> {
    return this.http.get<Waypoint>(`${this.url}/waypoints/${id}`);
  }

  create(data: WaypointRequest): Observable<Waypoint> {
    return this.http.post<Waypoint>(`${this.url}/waypoints`, data);
  }

  update(id: number, data: WaypointRequest): Observable<Waypoint> {
    return this.http.put<Waypoint>(`${this.url}/waypoints/${id}`, data);
  }

  markVisited(id: number): Observable<Waypoint> {
    return this.http.patch<Waypoint>(`${this.url}/waypoints/${id}/visit`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/waypoints/${id}`);
  }
}
