import { NgClass } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, from } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { ScreenWakeLockService } from '../../../../core/services/screen-wake-lock.service';
import { formatMsAsMmSs } from '../../../../core/utils/format-time';
import {
  LucideArrowLeft,
  LucideGripVertical,
  LucidePause,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideVolume2,
} from '../../../../shared/icons/app-lucide-icons';
import { FormatMsPipe } from '../../../../shared/pipes/format-ms.pipe';
import { ProjectStorageService } from '../../../projects/services/project-storage.service';
import { PlayerPlaybackService } from '../../services/player-playback.service';

@Component({
  selector: 'app-player-page',
  standalone: true,
  imports: [
    NgClass,
    RouterLink,
    FormatMsPipe,
    DragDropModule,
    LucideArrowLeft,
    LucidePlay,
    LucidePause,
    LucideSquare,
    LucideRotateCcw,
    LucideVolume2,
    LucideGripVertical,
  ],
  templateUrl: './player-page.component.html',
  styleUrl: './player-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPageComponent {
  readonly playback = inject(PlayerPlaybackService);
  readonly wakeLock = inject(ScreenWakeLockService);
  private readonly storage = inject(ProjectStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageLoading = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly isScrubbing = signal(false);
  readonly scrubMs = signal<number | null>(null);

  readonly seekThumbMs = computed(
    () => this.scrubMs() ?? this.playback.state().currentTimeMs,
  );
  readonly seekMax = computed(() => Math.max(1, this.playback.state().durationMs));

  readonly seekAriaValueText = computed(() => {
    const pos = formatMsAsMmSs(this.seekThumbMs());
    const dur = formatMsAsMmSs(this.playback.state().durationMs);
    return `${pos} de ${dur}`;
  });

  readonly hasInactiveStems = computed(() => {
    const lp = this.playback.loadedProject();
    if (!lp) {
      return false;
    }
    return lp.tracks.some((t) => !this.playback.hasStemAudio(t.id));
  });

  readonly combinedStatus = computed(() => {
    if (this.pageLoading()) {
      return 'loading';
    }
    const st = this.playback.state();
    if (st.status === 'ready' && this.playback.loadSummary()) {
      return 'ready-partial';
    }
    return st.status;
  });

  readonly statusLabel = computed(() => {
    if (this.pageLoading()) {
      return 'Cargando…';
    }
    const map: Record<string, string> = {
      loading: 'Cargando…',
      idle: 'Inactivo',
      ready: 'Listo',
      'ready-partial': 'Listo (parcial)',
      playing: 'Reproduciendo',
      paused: 'En pausa',
      stopped: 'Detenido',
      error: 'Error',
    };
    return map[this.combinedStatus()] ?? this.combinedStatus();
  });

  readonly showWakeLockUnavailable = computed(
    () =>
      this.playback.state().status === 'playing' &&
      (!this.wakeLock.supported() || this.wakeLock.error() !== null),
  );

  constructor() {
    effect(() => {
      const shouldHold = this.playback.state().status === 'playing';
      void this.wakeLock.setDesired(shouldHold);
    });

    this.destroyRef.onDestroy(() => {
      void this.wakeLock.releaseLock();
    });

    this.route.paramMap
      .pipe(
        tap(() => {
          this.pageLoading.set(true);
          this.pageError.set(null);
          this.scrubMs.set(null);
          this.isScrubbing.set(false);
          this.playback.clearLoadSummary();
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
    this.isScrubbing.set(true);
    this.scrubMs.set(el.valueAsNumber);
    el.setPointerCapture(ev.pointerId);
  }

  onSeekInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).valueAsNumber;
    this.scrubMs.set(v);
  }

  onSeekPointerUp(): void {
    if (!this.isScrubbing()) {
      return;
    }
    const ms = this.scrubMs();
    if (ms !== null) {
      this.playback.seekTo(ms);
    }
    this.isScrubbing.set(false);
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

  seekDisabled(): boolean {
    return this.playDisabled() || this.playback.state().durationMs <= 0;
  }

  trackListDisabled(): boolean {
    const tracks = this.playback.loadedProject()?.tracks;
    return (
      this.pageLoading() ||
      this.playback.reorderSaving() ||
      !tracks ||
      tracks.length < 2
    );
  }

  onTrackDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    void this.playback.reorderTracks(event.previousIndex, event.currentIndex);
  }

  volumePercent(linear: number): number {
    return Math.round(linear * 100);
  }

  isVolumeAt(linear: number, percent: 0 | 50 | 100): boolean {
    return Math.abs(linear - percent / 100) < 0.04;
  }

  setTrackVolumeLevel(trackId: string, percent: 0 | 50 | 100): void {
    this.playback.setTrackVolume(trackId, percent / 100);
  }
}
