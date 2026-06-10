import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TripService } from '../../../../core/services/trip.service';
import { WaypointService } from '../../../../core/services/waypoint.service';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { Trip } from '../../../../shared/models/trip.model';
import { Vehicle } from '../../../../shared/models/vehicle.model';
import { Waypoint } from '../../../../shared/models/waypoint.model';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly tripService = inject(TripService);
  private readonly vehicleService = inject(VehicleService);
  private readonly waypointService = inject(WaypointService);

  readonly trip = signal<Trip | null>(null);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly waypoints = signal<Waypoint[]>([]);

  ngOnInit(): void {
    const tripId = Number(this.id());
    this.tripService.getById(tripId).subscribe((t) => this.trip.set(t));
    this.vehicleService.getAll(tripId).subscribe((v) => this.vehicles.set(v));
    this.waypointService.getByTrip(tripId).subscribe((w) => this.waypoints.set(w));
  }
}
