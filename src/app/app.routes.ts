import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/registro/registro';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tabletop } from './pages/tabletop/tabletop';
import { authGuard } from './guards/auth.guard';
import { JoinComponent } from './pages/join/join';
import { VerifyComponent } from './pages/verify/verify';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard]
  },
  {
    path: 'tabletop/:id',
    component: Tabletop,
    canActivate: [authGuard]
  },
  {
    path: 'join/:code',
    component: JoinComponent
  },
  {
    path: 'verify/:token',
    component: VerifyComponent
  }
];