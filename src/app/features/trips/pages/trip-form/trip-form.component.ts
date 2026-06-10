import { Component, inject, input, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TripService } from '../../../../core/services/trip.service';

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './trip-form.component.html',
  styleUrl: './trip-form.component.scss',
})
export class TripFormComponent implements OnInit {
  readonly id = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly router = inject(Router);

  readonly isEdit = () => !!this.id();

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    destination: ['', Validators.required],
    destinationLat: [0, Validators.required],
    destinationLng: [0, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    creatorId: [1, Validators.required],
  });

  ngOnInit(): void {
    if (this.id()) {
      this.tripService.getById(Number(this.id())).subscribe((trip) => {
        this.form.patchValue(trip);
      });
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue() as any;

    const action = this.id()
      ? this.tripService.update(Number(this.id()), data)
      : this.tripService.create(data);

    action.subscribe(() => this.router.navigate(['/trips']));
  }
}
