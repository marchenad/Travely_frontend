import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { VehicleService } from '../../../../core/services/vehicle.service';
import { VehicleLocationService } from '../../../../core/services/vehicle-location.service';
import { Vehicle } from '../../../../shared/models/vehicle.model';
import { VehicleLocation } from '../../../../shared/models/vehicle-location.model';

@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './vehicle-detail.component.html',
  styleUrl: './vehicle-detail.component.scss',
})
export class VehicleDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly vehicleService = inject(VehicleService);
  private readonly locationService = inject(VehicleLocationService);

  readonly vehicle = signal<Vehicle | null>(null);
  readonly location = signal<VehicleLocation | null>(null);

  ngOnInit(): void {
    const vehicleId = Number(this.id());
    this.vehicleService.getById(vehicleId).subscribe((v) => this.vehicle.set(v));
    this.locationService
      .getLatestByVehicle(vehicleId)
      .subscribe((l) => this.location.set(l));
  }
}
