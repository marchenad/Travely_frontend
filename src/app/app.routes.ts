import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/map/map.component').then((m) => m.MapComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/pages/user-profile/user-profile.component').then(
        (m) => m.UserProfileComponent
      ),
  },
  {
    path: 'trips',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/trips/trips.routes').then((r) => r.TRIPS_ROUTES),
      },
    ],
  },
  {
    path: 'vehicles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/vehicles/vehicles.routes').then(
            (r) => r.VEHICLES_ROUTES
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
