import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

constructor(private router: Router) {}

  goToTabletop() {
    this.router.navigate(['/tabletop']);
  }
}
