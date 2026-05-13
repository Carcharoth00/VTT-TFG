import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/registro/registro';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tabletop } from './pages/tabletop/tabletop';
import { authGuard } from './guards/auth.guard';
import { JoinComponent } from './pages/join/join';
import { VerifyComponent } from './pages/verify/verify';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/reset-password/reset-password';

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
  },
  { 
    path: 'forgot-password', 
    component: ForgotPasswordComponent 
  },
  { 
    path: 'reset-password/:token', 
    component: ResetPasswordComponent 
  },
];