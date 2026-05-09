import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class RegisterComponent {
  // Datos del formulario
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  role: 'player' | 'gm' = 'player';

  // Estados
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  // ========== SUBMIT DEL FORMULARIO ==========
  onSubmit(): void {
    // Limpiar errores anteriores
    this.errorMessage = '';

    // Validaciones
    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Todos los campos son obligatorios';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Email inválido';
      return;
    }

    // Iniciar loading
    this.isLoading = true;

    // Llamar al servicio
    this.authService.register({
      username: this.username,
      email: this.email,
      password: this.password,
      role: this.role
    }).subscribe({
      next: (response) => {
        console.log('Registro exitoso:', response);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Error en registro:', error);
        this.isLoading = false;

        if (error.status === 409) {
          this.errorMessage = 'El email o nombre de usuario ya está en uso';
        } else if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al registrarse. Intenta de nuevo.';
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  // ========== TOGGLE MOSTRAR CONTRASEÑA ==========
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}