import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb      = inject(FormBuilder);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  readonly error   = signal('');
  readonly loading = signal(false);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.error.set('Email o contraseña incorrectos');
        this.loading.set(false);
      },
    });
  }
}
