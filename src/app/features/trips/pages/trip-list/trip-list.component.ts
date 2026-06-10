import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { TripService } from '../../../../core/services/trip.service';
import { Trip } from '../../../../shared/models/trip.model';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent {
  private readonly tripService = inject(TripService);

  readonly trips$ = this.tripService.getAll();
}
