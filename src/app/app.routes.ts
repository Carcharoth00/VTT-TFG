import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tabletop } from './pages/tabletop/tabletop';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
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