import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/registro/registro';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tabletop } from './pages/tabletop/tabletop';

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
    component: Dashboard
  },
  {
    path: 'tabletop',
    component: Tabletop
  }
];