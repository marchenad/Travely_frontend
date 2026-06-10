import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Trip, TripRequest, TripStatus, PageResponse } from '../../shared/models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/trips`;

  getAll(creatorId?: number): Observable<Trip[]> {
    const params = creatorId
      ? new HttpParams().set('creatorId', creatorId)
      : undefined;
    return this.http.get<Trip[]>(this.url, { params });
  }

  getAllPaged(creatorId: number, page: number, size = 10): Observable<PageResponse<Trip>> {
    const params = new HttpParams()
      .set('creatorId', creatorId)
      .set('page', page)
      .set('size', size);
    return this.http.get<PageResponse<Trip>>(this.url, { params });
  }

  getById(id: number): Observable<Trip> {
    return this.http.get<Trip>(`${this.url}/${id}`);
  }

  create(data: TripRequest): Observable<Trip> {
    return this.http.post<Trip>(this.url, data);
  }

  update(id: number, data: TripRequest): Observable<Trip> {
    return this.http.put<Trip>(`${this.url}/${id}`, data);
  }

  updateStatus(id: number, status: TripStatus): Observable<Trip> {
    const params = new HttpParams().set('status', status);
    return this.http.patch<Trip>(`${this.url}/${id}/status`, null, { params });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
