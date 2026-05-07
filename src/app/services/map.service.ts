import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

export interface GameMap {
  id: number;
  game_id: number;
  name: string;
  grid_cols: number;
  grid_rows: number;
  grid_size: number;
  is_active: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private apiUrl = `${environment.apiUrl}/maps`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  getMaps(gameId: number): Observable<{ maps: GameMap[] }> {
    return this.http.get<{ maps: GameMap[] }>(
      `${this.apiUrl}/${gameId}`,
      { headers: this.getHeaders() }
    );
  }

  getActiveMap(gameId: number): Observable<{ map: GameMap | null }> {
    return this.http.get<{ map: GameMap | null }>(
      `${this.apiUrl}/${gameId}/active`,
      { headers: this.getHeaders() }
    );
  }

  getMapImage(mapId: number): Observable<{ image: string }> {
    return this.http.get<{ image: string }>(
      `${this.apiUrl}/image/${mapId}`,
      { headers: this.getHeaders() }
    );
  }

  uploadMap(gameId: number, name: string, imageData: string, gridConfig: { cols: number, rows: number, size: number }): Observable<{ message: string, map: GameMap }> {
    return this.http.post<{ message: string, map: GameMap }>(
      `${this.apiUrl}/${gameId}`,
      {
        name,
        image_data: imageData,
        grid_cols: gridConfig.cols,
        grid_rows: gridConfig.rows,
        grid_size: gridConfig.size
      },
      { headers: this.getHeaders() }
    );
  }

  activateMap(mapId: number, gameId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/${mapId}/activate`,
      { gameId },
      { headers: this.getHeaders() }
    );
  }

  deleteMap(mapId: number, gameId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${mapId}`,
      { headers: this.getHeaders(), body: { gameId } }
    );
  }
}