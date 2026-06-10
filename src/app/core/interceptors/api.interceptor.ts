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
  // CORRECCIÓN: Ahora identifica las llamadas hacia el túnel seguro de Cloudflare
  const isApiCall =
    req.url.startsWith('/') ||
    req.url.includes('api-travely.devdyd.com');

  const token = localStorage.getItem('travely_token');

  // Clonamos los headers básicos
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Si existe token, lo añadimos
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Aplicamos los headers solo si es una llamada a nuestra API
  const outReq = isApiCall ? req.clone({ setHeaders: headers }) : req;

  // Si no es una llamada a la API, dejamos pasar la petición tal cual
  if (!isApiCall) return next(outReq);

  const toast = inject(ToastService);
  const auth  = inject(AuthService);

  return next(outReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Si el backend nos rechaza por 401, cerramos sesión automáticamente
      if (err.status === 401) {
        auth.logout();
        return EMPTY;
      }

      // Solo muestra toast para mutaciones (POST, PUT, DELETE, etc.)
      // para evitar spam en peticiones GET de fondo
      if (req.method !== 'GET') {
        const msg = API_ERROR_MESSAGES[err.status] ?? `Error inesperado (${err.status})`;
        toast.error(msg);
      }
      return throwError(() => err);
    }),
  );
};
