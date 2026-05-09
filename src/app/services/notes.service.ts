import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

export interface Note {
  id: number;
  user_id: number;
  game_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  private apiUrl = `${environment.apiUrl}/notes`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  getNotes(gameId: number): Observable<{ notes: Note[] }> {
    return this.http.get<{ notes: Note[] }>(
      `${this.apiUrl}/${gameId}`,
      { headers: this.getHeaders() }
    );
  }

  getNote(gameId: number, id: number): Observable<{ note: Note }> {
    return this.http.get<{ note: Note }>(
      `${this.apiUrl}/${gameId}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  create(gameId: number, title: string, content: string): Observable<{ message: string, note: Note }> {
    return this.http.post<{ message: string, note: Note }>(
      `${this.apiUrl}/${gameId}`,
      { title, content },
      { headers: this.getHeaders() }
    );
  }

  update(id: number, title: string, content: string): Observable<{ message: string, note: Note }> {
    return this.http.put<{ message: string, note: Note }>(
      `${this.apiUrl}/${id}`,
      { title, content },
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