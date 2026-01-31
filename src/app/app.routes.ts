import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Tabletop } from './tabletop/tabletop';

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