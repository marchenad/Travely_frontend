import { Component, inject, signal, ViewChild, ElementRef, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { User } from '../../../../shared/models/user.model';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly toast       = inject(ToastService);
  readonly themeService        = inject(ThemeService);

  readonly user      = signal<User | null>(null);
  readonly editMode  = signal(false);
  readonly uploading = signal(false);
  readonly saving    = signal(false);

  editName  = '';
  editPhone = '';

  ngOnInit(): void {
    const session = this.authService.currentUser();
    if (!session) return;
    this.userService.getById(session.userId).subscribe((u) => {
      // Mezcla la foto guardada en sesión si el servidor aún no la devuelve (MapStruct no regenerado)
      const pic = u.profilePicture ?? session.profilePicture;
      this.user.set({ ...u, profilePicture: pic });
      if (pic && !u.profilePicture) this.authService.setProfilePicture(pic);
    });
  }

  getInitial(): string {
    return this.user()?.name?.[0]?.toUpperCase() ?? '?';
  }

  logout(): void {
    this.authService.logout();
  }

  toggleEdit(): void {
    const u = this.user();
    if (!u) return;
    this.editName  = u.name;
    this.editPhone = u.phone ?? '';
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveProfile(): void {
    const u = this.user();
    if (!u || this.saving()) return;
    this.saving.set(true);
    this.userService.update(u.id, { name: this.editName, email: u.email, phone: this.editPhone })
      .subscribe({
        next: (updated) => {
          this.user.set(updated);
          this.editMode.set(false);
          this.saving.set(false);
          this.toast.success('Perfil actualizado');
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('No se pudo guardar');
        },
      });
  }

  triggerFileInput(): void {
    if (this.uploading()) return;
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = '';

    const u = this.user();
    if (!u) return;

    this.resizeImage(file, 256).then((base64) => {
      // Actualización optimista: mostrar la foto inmediatamente
      this.user.update((prev) => prev ? { ...prev, profilePicture: base64 } : prev);
      this.authService.setProfilePicture(base64);
      this.uploading.set(true);

      this.userService.uploadAvatar(u.id, base64).subscribe({
        next: (updated) => {
          // Si el servidor devuelve profilePicture, usamos esa; si no, mantenemos la optimista
          if (updated.profilePicture) {
            this.user.set(updated);
            this.authService.setProfilePicture(updated.profilePicture);
          }
          this.uploading.set(false);
          this.toast.success('Foto actualizada');
        },
        error: () => {
          // Revertir en caso de error
          this.user.set(u);
          this.authService.setProfilePicture(u.profilePicture ?? '');
          this.uploading.set(false);
          this.toast.error('No se pudo subir la foto');
        },
      });
    });
  }

  private resizeImage(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const side   = Math.min(img.width, img.height, maxSize);
          const canvas = document.createElement('canvas');
          canvas.width  = side;
          canvas.height = side;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, side, side);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
}
