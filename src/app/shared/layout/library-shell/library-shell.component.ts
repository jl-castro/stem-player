import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { LucideFolderOpen, LucideListMusic } from '../../icons/app-lucide-icons';

@Component({
  selector: 'app-library-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideFolderOpen, LucideListMusic],
  templateUrl: './library-shell.component.html',
  styleUrl: './library-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryShellComponent {}
