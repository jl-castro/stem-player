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
  HostListener,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, EMPTY, from } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import type { Setlist, StemPanMode } from '../../../../core/models';
import { sortSetlistEntriesByOrder } from '../../../../core/utils/setlist-order.util';
import { ScreenWakeLockService } from '../../../../core/services/screen-wake-lock.service';
import { formatMsAsMmSs } from '../../../../core/utils/format-time';
import {
  LucideArrowLeft,
  LucideChevronLeft,
  LucideChevronRight,
  LucideGripVertical,
  LucidePause,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideVolume2,
} from '../../../../shared/icons/app-lucide-icons';
import { FormatMsPipe } from '../../../../shared/pipes/format-ms.pipe';
import { SetlistPreloadService } from '../../../setlists/services/setlist-preload.service';
import { SetlistStorageService } from '../../../setlists/services/setlist-storage.service';
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
    LucideChevronLeft,
    LucideChevronRight,
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
  readonly setlistPreload = inject(SetlistPreloadService);
  private readonly storage = inject(ProjectStorageService);
  private readonly setlistStorage = inject(SetlistStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('mixerStrip') private mixerStripRef?: ElementRef<HTMLElement>;

  readonly activeSetlist = signal<Setlist | null>(null);
  readonly activeEntryIndex = signal(0);
  private readonly setlistPackNames = signal<ReadonlyMap<string, string>>(new Map());

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

  readonly seekThumbMs = computed(() => {
    if (this.pageLoading()) {
      return 0;
    }
    return this.scrubMs() ?? this.playback.state().currentTimeMs;
  });
  readonly seekMax = computed(() =>
    this.pageLoading() ? 1 : Math.max(1, this.playback.state().durationMs),
  );
  readonly transportDurationMs = computed(() =>
    this.pageLoading() ? 0 : this.playback.state().durationMs,
  );

  readonly seekAriaValueText = computed(() => {
    const pos = formatMsAsMmSs(this.seekThumbMs());
    const dur = formatMsAsMmSs(this.transportDurationMs());
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

  readonly loadProgressDetail = computed(() => {
    const p = this.playback.loadProgress();
    if (!p || p.total <= 0) {
      return null;
    }
    return `${p.loaded}/${p.total}`;
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

  readonly hasSetlistNav = computed(() => !!this.activeSetlist());

  readonly setlistPositionLabel = computed(() => {
    const setlist = this.activeSetlist();
    if (!setlist || setlist.entries.length === 0) {
      return '';
    }
    return `${this.activeEntryIndex() + 1}/${setlist.entries.length} · ${setlist.name}`;
  });

  readonly hasPreviousPack = computed(() => this.activeEntryIndex() > 0);

  readonly hasNextPack = computed(() => {
    const setlist = this.activeSetlist();
    if (!setlist) {
      return false;
    }
    return this.activeEntryIndex() < setlist.entries.length - 1;
  });

  readonly nextPackReady = computed(() => {
    const setlist = this.activeSetlist();
    if (!setlist) {
      return true;
    }
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const next = entries[this.activeEntryIndex() + 1];
    if (!next) {
      return true;
    }
    return this.setlistPreload.isReady(next.packId);
  });

  readonly nextPackDisabled = computed(() => {
    if (!this.hasNextPack()) {
      return true;
    }
    if (this.pageLoading()) {
      return true;
    }
    return this.playback.liveMode() && !this.nextPackReady();
  });

  readonly showNextPackPreloadHint = computed(() => {
    if (
      !this.hasSetlistNav() ||
      this.pageLoading() ||
      !this.hasNextPack() ||
      !this.playback.liveMode() ||
      this.nextPackReady()
    ) {
      return false;
    }
    const packId = this.nextEntryPackId();
    return packId ? this.setlistPreload.getStatus(packId) === 'loading' : false;
  });

  readonly previousPackDisabled = computed(
    () => !this.hasPreviousPack() || this.pageLoading(),
  );

  readonly nextEntryPackName = computed(() => {
    const setlist = this.activeSetlist();
    if (!setlist) {
      return null;
    }
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const next = entries[this.activeEntryIndex() + 1];
    if (!next) {
      return null;
    }
    return this.setlistPackNames().get(next.packId) ?? null;
  });

  readonly nextPackStatusHint = computed(() => {
    if (this.pageLoading()) {
      const percent = this.loadProgressPercent();
      return percent !== null ? `${percent} %` : 'Cargando…';
    }
    if (!this.hasNextPack()) {
      return '';
    }
    if (this.nextPackReady()) {
      return 'Listo';
    }
    const status = this.nextEntryPackId()
      ? this.setlistPreload.getStatus(this.nextEntryPackId()!)
      : 'pending';
    if (status === 'loading') {
      return 'Precargando…';
    }
    if (status === 'error') {
      return 'Sin memoria';
    }
    return 'Pendiente';
  });

  readonly isAtPackEnd = computed(() => {
    if (!this.hasSetlistNav() || !this.hasNextPack() || this.pageLoading()) {
      return false;
    }
    const st = this.playback.state();
    if (st.status !== 'paused' && st.status !== 'stopped') {
      return false;
    }
    const dur = st.durationMs;
    return dur > 0 && st.currentTimeMs >= dur - 500;
  });

  readonly setlistNavCenterTitle = computed(() => {
    if (this.pageLoading()) {
      return 'Cargando pack actual…';
    }
    if (!this.hasNextPack()) {
      return 'Fin del setlist';
    }
    return this.nextEntryPackName() ?? 'Siguiente pack';
  });

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
      this.setlistPreload.clearSetlistPlaybackPins();
      this.playback.detachFromPlayer();
      this.mixerResizeObserver?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.onWindowResize);
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize, { passive: true });
    }

    effect(() => {
      const setlist = this.activeSetlist();
      const index = this.activeEntryIndex();
      const projectId = this.playback.state().projectId;
      if (!setlist || !projectId) {
        this.setlistPreload.clearSetlistPlaybackPins();
        return;
      }
      const entries = sortSetlistEntriesByOrder(setlist.entries);
      const nextPackId = entries[index + 1]?.packId ?? null;
      const pinNext =
        nextPackId && this.setlistPreload.isReady(nextPackId) ? nextPackId : null;
      this.setlistPreload.pinSetlistPlayback(projectId, pinNext);
    });

    effect(() => {
      if (this.pageLoading()) {
        return;
      }
      const setlist = this.activeSetlist();
      const index = this.activeEntryIndex();
      const st = this.playback.state();
      if (!setlist) {
        return;
      }
      this.setlistPreload.warmNextWhenHalfway(
        setlist,
        index,
        st.currentTimeMs,
        st.durationMs,
        st.status === 'playing',
      );
    });

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        tap(() => {
          this.pageLoading.set(true);
          this.pageError.set(null);
          this.scrubMs.set(null);
          this.isScrubbing.set(false);
          this.playback.clearLoadSummary();
          this.resetMixerScrollMetrics();
        }),
        switchMap(([pm, qm]) => {
          const projectId = pm.get('projectId');
          if (!projectId) {
            this.pageLoading.set(false);
            this.pageError.set('Falta el id del pack en la ruta.');
            return EMPTY;
          }

          const setlistId = qm.get('setlist');
          const entryRaw = qm.get('entry');
          const shouldAutoplay = qm.get('autoplay') === '1';

          this.setlistPreload.switchToSetlistContext(setlistId);

          return from(
            Promise.all([
              this.storage.getProjectById(projectId),
              setlistId ? this.setlistStorage.getSetlistById(setlistId) : Promise.resolve(null),
            ]),
          ).pipe(
            switchMap(([project, setlist]) => {
              if (!project) {
                this.pageLoading.set(false);
                this.pageError.set('Pack no encontrado.');
                this.activeSetlist.set(null);
                return EMPTY;
              }

              if (setlistId && !setlist) {
                this.pageLoading.set(false);
                this.pageError.set('Setlist no encontrado.');
                this.activeSetlist.set(null);
                return EMPTY;
              }

              let entryIndex = 0;
              if (setlist) {
                const entries = sortSetlistEntriesByOrder(setlist.entries);
                if (entryRaw !== null) {
                  const parsed = Number.parseInt(entryRaw, 10);
                  entryIndex = Number.isFinite(parsed) ? parsed : 0;
                } else {
                  entryIndex = entries.findIndex((e) => e.packId === projectId);
                }
                entryIndex = Math.max(0, Math.min(entryIndex, Math.max(0, entries.length - 1)));
                this.activeSetlist.set({ ...setlist, entries });
                this.activeEntryIndex.set(entryIndex);
                void this.loadSetlistPackNames(setlist);
              } else {
                this.activeSetlist.set(null);
                this.activeEntryIndex.set(0);
                this.setlistPackNames.set(new Map());
              }

              this.setlistPreload.prepareForPackNavigation(project.id);

              return from(this.playback.loadProject(project)).pipe(
                tap(() => {
                  const st = this.playback.state();
                  if (st.status === 'error') {
                    this.pageError.set(st.errorMessage ?? 'No se pudo preparar el audio.');
                  } else {
                    if (shouldAutoplay && st.canPlay) {
                      queueMicrotask(() => this.playback.play());
                    }
                  }
                  this.pageLoading.set(false);
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => this.refreshMixerScrollMetrics());
                  });
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

  goToPreviousPack(): void {
    this.goToAdjacentPack(-1);
  }

  goToNextPack(): void {
    const atEnd = this.isAtPackEnd();
    const wasPlaying = this.playback.state().status === 'playing';
    this.goToAdjacentPack(1, atEnd || wasPlaying);
  }

  private nextEntryPackId(): string | null {
    const setlist = this.activeSetlist();
    if (!setlist) {
      return null;
    }
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    return entries[this.activeEntryIndex() + 1]?.packId ?? null;
  }

  @HostListener('document:keydown', ['$event'])
  onSetlistKeydown(ev: KeyboardEvent): void {
    if (!this.hasSetlistNav() || this.pageLoading() || this.isScrubbing()) {
      return;
    }
    const target = ev.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    ) {
      return;
    }
    if (ev.key === 'ArrowRight' && !this.nextPackDisabled()) {
      ev.preventDefault();
      this.goToNextPack();
    } else if (ev.key === 'ArrowLeft' && !this.previousPackDisabled()) {
      ev.preventDefault();
      this.goToPreviousPack();
    }
  }

  private goToAdjacentPack(delta: -1 | 1, autoplay = false): void {
    const setlist = this.activeSetlist();
    if (!setlist) {
      return;
    }
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const nextIndex = this.activeEntryIndex() + delta;
    if (nextIndex < 0 || nextIndex >= entries.length) {
      return;
    }
    const entry = entries[nextIndex]!;
    void this.router.navigate(['/player', entry.packId], {
      queryParams: {
        setlist: setlist.id,
        entry: nextIndex,
        ...(autoplay ? { autoplay: '1' } : {}),
      },
    });
  }

  private async loadSetlistPackNames(setlist: Setlist): Promise<void> {
    const uniqueIds = [...new Set(setlist.entries.map((e) => e.packId))];
    const pairs = await Promise.all(
      uniqueIds.map(async (id) => {
        const pack = await this.storage.getProjectById(id);
        return [id, pack?.name ?? 'Pack eliminado'] as const;
      }),
    );
    this.setlistPackNames.set(new Map(pairs));
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

  private resetMixerScrollMetrics(): void {
    this.mixerScrollValue.set(0);
    this.mixerScrollMax.set(0);
    this.mixerScrollWidth.set(0);
    this.mixerScrollClientWidth.set(0);
    const el = this.mixerStripRef?.nativeElement;
    if (el) {
      el.scrollLeft = 0;
    }
  }

  private refreshMixerScrollMetrics(): void {
    const el = this.mixerStripRef?.nativeElement;
    if (!el) {
      this.resetMixerScrollMetrics();
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
