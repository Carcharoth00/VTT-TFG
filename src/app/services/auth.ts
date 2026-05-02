import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

// Interfaces
interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  role: 'player' | 'gm';
  created_at: Date;
}

interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  role?: 'player' | 'gm';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Detectar si estamos en el navegador o en el servidor
  private platformId = inject(PLATFORM_ID);
  private isBrowser: boolean;

  // URL del backend
  private apiUrl = 'http://localhost:3001/api/auth';

  // Estado del usuario actual (Observable para que otros componentes puedan suscribirse)
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Estado de autenticación
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Verificar si estamos en el navegador
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    // Solo verificar token si estamos en el navegador
    if (this.isBrowser) {
      this.checkToken();
    }
  }

  // ========== VERIFICAR TOKEN AL INICIO ==========
  private checkToken(): void {
    const token = this.getToken();
    
    if (token) {
      // Verificar que el token sea válido
      this.verifyToken().subscribe({
        next: (response) => {
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        },
        error: () => {
          // Token inválido o expirado
          this.logout();
        }
      });
    }
  }

  // ========== REGISTRO ==========
  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data)
      .pipe(
        tap(response => {
          // Guardar token y usuario
          this.setToken(response.token);
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        })
      );
  }

  // ========== LOGIN ==========
  login(data: LoginData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data)
      .pipe(
        tap(response => {
          // Guardar token y usuario
          this.setToken(response.token);
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        })
      );
  }

  // ========== LOGOUT ==========
  logout(): void {
    // Eliminar token
    if (this.isBrowser) {
      localStorage.removeItem('vtt_token');
    }
    
    // Limpiar estado
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    
    // Redirigir a login
    this.router.navigate(['/login']);
  }

  // ========== OBTENER PERFIL ==========
  getProfile(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/me`, {
      headers: this.getAuthHeaders()
    });
  }

  // ========== VERIFICAR TOKEN ==========
  verifyToken(): Observable<{ valid: boolean; user: User }> {
    return this.http.post<{ valid: boolean; user: User }>(
      `${this.apiUrl}/verify`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  // ========== HELPERS (funciones auxiliares) ==========

  // Guardar token en localStorage (solo en navegador)
  private setToken(token: string): void {
    if (this.isBrowser) {
      localStorage.setItem('vtt_token', token);
    }
  }

  // Obtener token de localStorage (solo en navegador)
  public getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('vtt_token');
    }
    return null;
  }

  // Obtener headers con token para peticiones autenticadas
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Verificar si el usuario está autenticado (forma síncrona)
  public isLoggedIn(): boolean {
     return this.getToken() !== null;
  }

  // Obtener el usuario actual (forma síncrona)
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}