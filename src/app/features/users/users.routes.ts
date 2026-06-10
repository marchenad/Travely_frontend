import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/user-profile/user-profile.component').then(
        (m) => m.UserProfileComponent
      ),
  },
];
