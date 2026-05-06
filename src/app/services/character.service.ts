import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

export interface CharacterStats {
  [key: string]: number;
  fuerza: number;
  destreza: number;
  constitucion: number;
  inteligencia: number;
  sabiduria: number;
  carisma: number;
}

export interface Character {
  id: number;
  user_id: number;
  game_id: number;
  name: string;
  hp: number;
  max_hp: number;
  ac: number;
  stats: CharacterStats | null;
  skills: any | null;
  notes: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class CharacterService {

  private apiUrl = `${environment.apiUrl}/characters`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  getByGame(gameId: number): Observable<{ characters: Character[] }> {
    return this.http.get<{ characters: Character[] }>(
      `${this.apiUrl}/${gameId}`,
      { headers: this.getHeaders() }
    );
  }

  getMyCharacters(gameId: number): Observable<{ characters: Character[] }> {
    return this.http.get<{ characters: Character[] }>(
      `${this.apiUrl}/${gameId}/mine`,
      { headers: this.getHeaders() }
    );
  }

  create(gameId: number, data: Partial<Character>): Observable<{ message: string, character: Character }> {
    return this.http.post<{ message: string, character: Character }>(
      `${this.apiUrl}/${gameId}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  update(id: number, data: Partial<Character>): Observable<{ message: string, character: Character }> {
    return this.http.put<{ message: string, character: Character }>(
      `${this.apiUrl}/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }
}