import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/projects/pages/projects-page/projects-page.component').then(
        (m) => m.ProjectsPageComponent,
      ),
  },
  {
    path: 'player',
    loadComponent: () =>
      import('./features/player/pages/player-page/player-page.component').then(
        (m) => m.PlayerPageComponent,
      ),
  },
  { path: '**', redirectTo: 'projects' },
];
