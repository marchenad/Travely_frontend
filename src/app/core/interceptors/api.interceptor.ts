import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, EMPTY } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

const API_ERROR_MESSAGES: Record<number, string> = {
  0:   'Sin conexión con el servidor',
  401: 'Sesión expirada, vuelve a iniciar sesión',
  403: 'No tienes permiso para realizar esta acción',
  404: 'Recurso no encontrado',
  500: 'Error interno del servidor',
  503: 'Servicio no disponible',
};

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = req.url.startsWith('/') || req.url.includes('localhost:8080');

  const token = localStorage.getItem('travely_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const outReq = isApiCall ? req.clone({ setHeaders: headers }) : req;

  if (!isApiCall) return next(outReq);

  const toast = inject(ToastService);
  const auth  = inject(AuthService);

  return next(outReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();
        return EMPTY;
      }
      // Solo muestra toast para mutaciones (no GET) para no spamear el polling de fondo
      if (req.method !== 'GET') {
        const msg = API_ERROR_MESSAGES[err.status] ?? `Error inesperado (${err.status})`;
        toast.error(msg);
      }
      return throwError(() => err);
    }),
  );
};
