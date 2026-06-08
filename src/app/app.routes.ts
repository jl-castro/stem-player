import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'packs' },
  { path: 'projects', redirectTo: 'packs' },
  {
    path: 'packs',
    loadComponent: () =>
      import('./features/projects/pages/projects-page/projects-page.component').then(
        (m) => m.ProjectsPageComponent,
      ),
  },
  {
    path: 'player/:projectId',
    loadComponent: () =>
      import('./features/player/pages/player-page/player-page.component').then(
        (m) => m.PlayerPageComponent,
      ),
  },
  { path: '**', redirectTo: 'packs' },
];
