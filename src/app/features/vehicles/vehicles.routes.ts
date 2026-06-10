import { Routes } from '@angular/router';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/vehicle-list/vehicle-list.component').then(
        (m) => m.VehicleListComponent
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/vehicle-detail/vehicle-detail.component').then(
        (m) => m.VehicleDetailComponent
      ),
  },
];
