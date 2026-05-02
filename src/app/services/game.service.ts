import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface Game {
  id: number;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: number;
  status: 'active' | 'paused' | 'finished';
  created_at: string;
  role_in_game: 'gm' | 'player';
  member_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {

  private apiUrl = 'http://localhost:3001/api/games';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  // Obtener mis partidas
  getMyGames(): Observable<{ games: Game[] }> {
    return this.http.get<{ games: Game[] }>(this.apiUrl, {
      headers: this.getHeaders()
    });
  }

  // Crear partida
  createGame(name: string, description: string): Observable<{ message: string, game: Game }> {
    return this.http.post<{ message: string, game: Game }>(
      this.apiUrl,
      { name, description },
      { headers: this.getHeaders() }
    );
  }

  // Unirse con código de invitación
  joinGame(invite_code: string): Observable<{ message: string, game: Game }> {
    return this.http.post<{ message: string, game: Game }>(
      `${this.apiUrl}/join`,
      { invite_code },
      { headers: this.getHeaders() }
    );
  }

  // Obtener detalle de una partida
  getGame(id: number): Observable<{ game: Game, members: any[], role: string }> {
    return this.http.get<{ game: Game, members: any[], role: string }>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // Eliminar partida
  deleteGame(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }
}