import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { VehicleService } from '../../../../core/services/vehicle.service';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.scss',
})
export class VehicleListComponent {
  private readonly vehicleService = inject(VehicleService);

  readonly vehicles$ = this.vehicleService.getAll();
}
