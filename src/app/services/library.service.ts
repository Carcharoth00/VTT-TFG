import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

export interface LibraryItem {
  id: number;
  game_id: number;
  name: string;
  image: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {

  private apiUrl = `${environment.apiUrl}/library`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` });
  }

  getItems(gameId: number): Observable<{ items: LibraryItem[] }> {
    return this.http.get<{ items: LibraryItem[] }>(`${this.apiUrl}/${gameId}`, { headers: this.getHeaders() });
  }

  addItem(gameId: number, name: string, image: string): Observable<{ item: LibraryItem }> {
    return this.http.post<{ item: LibraryItem }>(`${this.apiUrl}/${gameId}`, { name, image }, { headers: this.getHeaders() });
  }

  deleteItem(gameId: number, id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${gameId}/${id}`, { headers: this.getHeaders() });
  }
}