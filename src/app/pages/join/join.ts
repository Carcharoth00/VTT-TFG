import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { GameService } from '../../services/game.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './join.html',
  styleUrl: './join.css'
})
export class JoinComponent implements OnInit {
  message = 'Uniéndose a la partida...';
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private gameService: GameService
  ) { }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  ngOnInit() {
    const code = this.route.snapshot.params['code'];

    if (!this.authService.isLoggedIn()) {
      localStorage.setItem('pendingJoinCode', code);
      this.router.navigate(['/login']);
      return;
    }

    this.joinGame(code);
  }

  joinGame(code: string) {
  this.gameService.joinGame(code).subscribe({
    next: (response) => {
      this.message = '¡Unido correctamente! Entrando a la partida...';
      setTimeout(() => this.router.navigate(['/tabletop', response.game.id]), 1500);
    },
    error: (err) => {
      if (err.status === 409) {
        // Ya es miembro, buscar el game_id por el código
        this.gameService.getGameByCode(code).subscribe({
          next: (response) => {
            this.message = 'Ya eres miembro. Entrando a la partida...';
            setTimeout(() => this.router.navigate(['/tabletop', response.game.id]), 1500);
          },
          error: () => this.router.navigate(['/dashboard'])
        });
      } else {
        this.error = err.error?.message || 'Error al unirse a la partida';
      }
    }
  });
}
}