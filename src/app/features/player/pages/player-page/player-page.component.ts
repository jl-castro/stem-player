import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { from, EMPTY } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { FormatMsPipe } from '../../../../shared/pipes/format-ms.pipe';
import { ProjectStorageService } from '../../../projects/services/project-storage.service';
import { PlayerPlaybackService } from '../../services/player-playback.service';

@Component({
  selector: 'app-player-page',
  standalone: true,
  imports: [NgClass, RouterLink, FormatMsPipe],
  templateUrl: './player-page.component.html',
  styleUrl: './player-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPageComponent {
  readonly playback = inject(PlayerPlaybackService);
  private readonly storage = inject(ProjectStorageService);
  private readonly route = inject(ActivatedRoute);

  readonly pageLoading = signal(false);
  readonly pageError = signal<string | null>(null);

  readonly scrubMs = signal<number | null>(null);
  readonly seekThumbMs = computed(
    () => this.scrubMs() ?? this.playback.state().currentTimeMs,
  );
  readonly seekMax = computed(() => Math.max(1, this.playback.state().durationMs));

  readonly statusLabel = computed(() => {
    if (this.pageLoading()) {
      return 'Cargando…';
    }
    const s = this.playback.state().status;
    const map: Record<string, string> = {
      idle: 'Inactivo',
      ready: 'Listo',
      playing: 'Reproduciendo',
      paused: 'Pausa',
      stopped: 'Detenido',
      error: 'Error',
    };
    return map[s] ?? s;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.pageLoading.set(true);
          this.pageError.set(null);
        }),
        switchMap((pm) => {
          const projectId = pm.get('projectId');
          if (!projectId) {
            this.pageLoading.set(false);
            this.pageError.set('Falta el id del proyecto en la ruta.');
            return EMPTY;
          }
          return from(this.storage.getProjectById(projectId)).pipe(
            switchMap((project) => {
              if (!project) {
                this.pageLoading.set(false);
                this.pageError.set('Proyecto no encontrado.');
                return EMPTY;
              }
              return from(this.playback.loadProject(project)).pipe(
                tap(() => {
                  const st = this.playback.state();
                  if (st.status === 'error') {
                    this.pageError.set(st.errorMessage ?? 'No se pudo preparar el audio.');
                  }
                  this.pageLoading.set(false);
                }),
              );
            }),
            catchError((e) => {
              this.pageLoading.set(false);
              this.pageError.set(e instanceof Error ? e.message : String(e));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  onSeekPointerDown(ev: PointerEvent): void {
    const el = ev.target as HTMLInputElement;
    this.scrubMs.set(el.valueAsNumber);
  }

  onSeekInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).valueAsNumber;
    this.scrubMs.set(v);
    this.playback.seekTo(v);
  }

  onSeekPointerUp(): void {
    this.scrubMs.set(null);
  }

  togglePlayPause(): void {
    const s = this.playback.state().status;
    if (s === 'playing') {
      this.playback.pause();
    } else {
      this.playback.play();
    }
  }

  playDisabled(): boolean {
    return (
      this.pageLoading() ||
      !!this.pageError() ||
      !this.playback.state().canPlay ||
      this.playback.state().status === 'error'
    );
  }
}
