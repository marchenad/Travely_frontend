import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserRequest } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  create(data: UserRequest): Observable<User> {
    return this.http.post<User>(this.url, data);
  }

  update(id: number, data: UserRequest): Observable<User> {
    return this.http.put<User>(`${this.url}/${id}`, data);
  }

  uploadAvatar(id: number, base64: string): Observable<User> {
    return this.http.post<User>(`${this.url}/${id}/avatar`, { data: base64 });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
