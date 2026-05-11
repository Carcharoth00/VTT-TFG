import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  // Datos del formulario
  email = '';
  password = '';

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
    if (!this.email || !this.password) {
      this.errorMessage = 'Email y contraseña son obligatorios';
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
    this.authService.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: (response) => {
        console.log('Login exitoso:', response);
        const pendingCode = localStorage.getItem('pendingJoinCode');
        if (pendingCode) {
          localStorage.removeItem('pendingJoinCode');
          this.router.navigate(['/join', pendingCode]);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        console.error('Error en login:', error);
        this.isLoading = false;

        // Mostrar mensaje de error
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Verifica que el backend esté corriendo.';
        } else {
          this.errorMessage = 'Error al iniciar sesión. Intenta de nuevo.';
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