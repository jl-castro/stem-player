import { NgClass } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, from } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import type { StemPanMode } from '../../../../core/models';
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
  @ViewChild('mixerStrip') private mixerStripRef?: ElementRef<HTMLElement>;

  readonly pageLoading = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly isScrubbing = signal(false);
  readonly scrubMs = signal<number | null>(null);
  readonly mixerScrollValue = signal(0);
  readonly mixerScrollMax = signal(0);
  readonly mixerScrollWidth = signal(0);
  readonly mixerScrollClientWidth = signal(0);

  readonly mixerThumbWidthPercent = computed(() => {
    const scrollWidth = this.mixerScrollWidth();
    const clientWidth = this.mixerScrollClientWidth();
    if (scrollWidth <= 0 || clientWidth <= 0) {
      return 100;
    }
    return Math.min(100, (clientWidth / scrollWidth) * 100);
  });

  readonly mixerThumbLeftPercent = computed(() => {
    const max = this.mixerScrollMax();
    if (max <= 0) {
      return 0;
    }
    const travel = 100 - this.mixerThumbWidthPercent();
    return (this.mixerScrollValue() / max) * travel;
  });

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

  readonly loadProgressPercent = computed(() => {
    const p = this.playback.loadProgress();
    if (!p || p.total <= 0) {
      return null;
    }
    return Math.round((p.loaded / p.total) * 100);
  });

  readonly statusLabel = computed(() => {
    if (this.pageLoading()) {
      const p = this.playback.loadProgress();
      if (p) {
        return `${p.label} (${p.loaded}/${p.total})`;
      }
      return 'Cargando…';
    }
    if (this.playback.state().audioSuspended) {
      return 'Audio suspendido';
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
  readonly showMixerScroller = computed(
    () => !this.pageLoading() && this.mixerScrollMax() > 0,
  );

  private readonly onWindowResize = (): void => {
    this.refreshMixerScrollMetrics();
  };

  private mixerResizeObserver?: ResizeObserver;
  private mixerScrollbarDrag: {
    pointerId: number;
    startClientX: number;
    startScrollLeft: number;
    travelPx: number;
  } | null = null;

  constructor() {
    effect(() => {
      const shouldHold = this.playback.state().status === 'playing';
      void this.wakeLock.setDesired(shouldHold);
    });

    effect(() => {
      const trackCount = this.playback.loadedProject()?.tracks.length ?? 0;
      if (trackCount > 0 && !this.pageLoading()) {
        requestAnimationFrame(() => this.refreshMixerScrollMetrics());
      }
    });

    afterNextRender(() => {
      const el = this.mixerStripRef?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') {
        return;
      }
      this.mixerResizeObserver = new ResizeObserver(() => {
        this.refreshMixerScrollMetrics();
      });
      this.mixerResizeObserver.observe(el);
    });

    this.destroyRef.onDestroy(() => {
      void this.wakeLock.releaseLock();
      this.playback.detachFromPlayer();
      this.mixerResizeObserver?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.onWindowResize);
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize, { passive: true });
    }

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
                  requestAnimationFrame(() => this.refreshMixerScrollMetrics());
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
    return (
      this.playDisabled() ||
      this.playback.state().durationMs <= 0 ||
      this.playback.liveMode()
    );
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
    requestAnimationFrame(() => this.refreshMixerScrollMetrics());
  }

  onMixerStripScroll(ev: Event): void {
    const el = ev.target as HTMLElement | null;
    if (!el) {
      return;
    }
    this.syncMixerScrollFromElement(el);
  }

  onMixerScrollbarPointerDown(ev: PointerEvent): void {
    const scrollbar = ev.currentTarget as HTMLElement | null;
    const track = scrollbar?.querySelector('.mixer-scrollbar__track') as HTMLElement | null;
    const thumb = scrollbar?.querySelector('.mixer-scrollbar__thumb');
    if (!scrollbar || !track || this.mixerScrollMax() <= 0) {
      return;
    }

    const isThumb = thumb?.contains(ev.target as Node) ?? false;
    const rect = track.getBoundingClientRect();
    const thumbW = rect.width * (this.mixerThumbWidthPercent() / 100);
    const travel = Math.max(1, rect.width - thumbW);

    if (isThumb) {
      this.mixerScrollbarDrag = {
        pointerId: ev.pointerId,
        startClientX: ev.clientX,
        startScrollLeft: this.mixerScrollValue(),
        travelPx: travel,
      };
      scrollbar.setPointerCapture(ev.pointerId);
    } else {
      this.scrollMixerFromTrackPointer(ev.clientX, track);
    }
    ev.preventDefault();
  }

  onMixerScrollbarPointerMove(ev: PointerEvent): void {
    const drag = this.mixerScrollbarDrag;
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    const strip = this.mixerStripRef?.nativeElement;
    if (!strip) {
      return;
    }
    const max = this.mixerScrollMax();
    const dx = ev.clientX - drag.startClientX;
    strip.scrollLeft = Math.max(
      0,
      Math.min(max, drag.startScrollLeft + (dx / drag.travelPx) * max),
    );
    this.syncMixerScrollFromElement(strip);
  }

  onMixerScrollbarPointerUp(ev: PointerEvent): void {
    const drag = this.mixerScrollbarDrag;
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    this.mixerScrollbarDrag = null;
    const scrollbar = ev.currentTarget as HTMLElement | null;
    if (scrollbar?.hasPointerCapture(ev.pointerId)) {
      scrollbar.releasePointerCapture(ev.pointerId);
    }
  }

  volumePercent(linear: number): number {
    return Math.round(linear * 100);
  }

  isPanAt(current: StemPanMode, expected: StemPanMode): boolean {
    return current === expected;
  }

  setTrackPanMode(trackId: string, mode: StemPanMode): void {
    this.playback.setTrackPan(trackId, mode);
  }

  private refreshMixerScrollMetrics(): void {
    const el = this.mixerStripRef?.nativeElement;
    if (!el) {
      this.mixerScrollValue.set(0);
      this.mixerScrollMax.set(0);
      this.mixerScrollWidth.set(0);
      this.mixerScrollClientWidth.set(0);
      return;
    }
    this.syncMixerScrollFromElement(el);
  }

  private syncMixerScrollFromElement(el: HTMLElement): void {
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    this.mixerScrollWidth.set(scrollWidth);
    this.mixerScrollClientWidth.set(clientWidth);
    this.mixerScrollValue.set(Math.round(el.scrollLeft));
    this.mixerScrollMax.set(Math.max(0, Math.round(scrollWidth - clientWidth)));
  }

  private scrollMixerFromTrackPointer(clientX: number, track: HTMLElement): void {
    const strip = this.mixerStripRef?.nativeElement;
    if (!strip) {
      return;
    }
    const max = this.mixerScrollMax();
    if (max <= 0) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const thumbW = rect.width * (this.mixerThumbWidthPercent() / 100);
    const travel = Math.max(0, rect.width - thumbW);
    let x = clientX - rect.left - thumbW / 2;
    x = Math.max(0, Math.min(travel, x));
    strip.scrollLeft = travel > 0 ? (x / travel) * max : 0;
    this.syncMixerScrollFromElement(strip);
  }
}
