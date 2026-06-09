import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/library-shell/library-shell.component').then(
        (m) => m.LibraryShellComponent,
      ),
    children: [
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
        path: 'setlists',
        loadComponent: () =>
          import('./features/setlists/pages/setlists-page/setlists-page.component').then(
            (m) => m.SetlistsPageComponent,
          ),
      },
      {
        path: 'setlists/:setlistId',
        loadComponent: () =>
          import('./features/setlists/pages/setlist-detail-page/setlist-detail-page.component').then(
            (m) => m.SetlistDetailPageComponent,
          ),
      },
    ],
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
