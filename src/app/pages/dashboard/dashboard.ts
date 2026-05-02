import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { GameService, Game } from '../../services/game.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  games: Game[] = [];
  currentUser: any = null;
  loading = false;
  error = '';

  // Control de modales
  showCreateModal = false;
  showJoinModal = false;

  // Formularios
  newGameName = '';
  newGameDescription = '';
  joinCode = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private gameService: GameService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.loadGames();
  }

  loadGames() {
    this.loading = true;
    console.log('Cargando partidas...');
    this.gameService.getMyGames().subscribe({
      next: (response) => {
        this.games = response.games;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.log('Error:', err);
        this.error = 'Error al cargar las partidas';
        this.loading = false;
      }
    });
  }

  createGame() {
    if (!this.newGameName.trim()) return;

    this.gameService.createGame(this.newGameName, this.newGameDescription).subscribe({
      next: (response) => {
        this.games.unshift(response.game);
        this.showCreateModal = false;
        this.newGameName = '';
        this.newGameDescription = '';
      },
      error: () => {
        this.error = 'Error al crear la partida';
      }
    });
  }

  joinGame() {
    if (!this.joinCode.trim()) return;

    this.gameService.joinGame(this.joinCode).subscribe({
      next: (response) => {
        this.games.unshift(response.game);
        this.showJoinModal = false;
        this.joinCode = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Código de invitación inválido';
      }
    });
  }

  enterGame(game: Game) {
    this.router.navigate(['/tabletop', game.id]);
  }

  logout() {
    this.authService.logout();
  }
}