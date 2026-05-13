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
  copiedCode: string | null = null;

  // Control de modales
  showCreateModal = false;
  showJoinModal = false;

  // Formularios
  newGameName = '';
  newGameDescription = '';
  joinCode = '';
  joinError = '';
  createError = '';

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
        this.showCreateModal = false;
        this.newGameName = '';
        this.newGameDescription = '';
        this.createError = '';
        this.router.navigate(['/tabletop', response.game.id]);
      },
      error: (err) => {
        this.createError = err.error?.error || 'Error al crear la partida';
        this.cdr.detectChanges();
      }
    });
  }

  joinGame() {
    if (!this.joinCode.trim()) return;

    this.gameService.joinGame(this.joinCode).subscribe({
      next: (response) => {
        this.showJoinModal = false;
        this.joinCode = '';
        this.router.navigate(['/tabletop', response.game.id]);
      },
      error: (err) => {
        this.joinError = err.error?.error || 'Código de invitación inválido';
        this.cdr.detectChanges();
      }
    });
  }

  enterGame(game: Game) {
    this.router.navigate(['/tabletop', game.id]);
  }

  logout() {
    this.authService.logout();
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  openJoinModal() {
    this.showJoinModal = true;
    this.cdr.detectChanges();
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
    this.copiedCode = code;
    setTimeout(() => { this.copiedCode = null; }, 2000);
  }

  deleteGame(game: Game) {
    if (!confirm(`¿Eliminar la partida "${game.name}"? Esta acción no se puede deshacer.`)) return;

    this.gameService.deleteGame(game.id).subscribe({
      next: () => {
        this.games = this.games.filter(g => g.id !== game.id);
      },
      error: () => alert('Error al eliminar la partida')
    });
  }

}