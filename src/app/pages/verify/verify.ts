import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify.html',
  styleUrl: './verify.css'
})
export class VerifyComponent implements OnInit {
  message = 'Verificando tu cuenta...';
  success = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) { }

  ngOnInit() {
    const token = this.route.snapshot.params['token'];
    this.http.get<{ message: string }>(`${environment.apiUrl}/auth/verify/${token}`)
      .subscribe({
        next: () => {
          this.success = true;
          this.message = '¡Cuenta verificada correctamente!';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err) => {
          this.error = err.error?.error || 'Token inválido o expirado';
        }
      });
  }
  
  goToLogin() {
    this.router.navigate(['/login']);
  }
}