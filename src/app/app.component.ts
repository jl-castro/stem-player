import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BackgroundWorkService } from './core/services/background-work.service';
import { LucideX } from './shared/icons/app-lucide-icons';

/** Raíz de la app: layout mínimo y salida del enrutador (secciones en `features/`). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideX],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly backgroundWork = inject(BackgroundWorkService);

  cancelBackgroundWork(): void {
    this.backgroundWork.cancelAll();
  }

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewportHeight = (): void => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--sp-app-height', `${Math.round(height)}px`);
    };

    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('scroll', syncViewportHeight);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
    });
  }
}
