import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = false;
  message = '';
  error = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef) { }

  onSubmit() {
    if (!this.email) return;
    this.isLoading = true;
    this.message = '';
    this.error = '';

    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email: this.email })
      .subscribe({
        next: (res) => {
          this.message = res.message;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Error al procesar la solicitud. Inténtalo de nuevo.';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }
}