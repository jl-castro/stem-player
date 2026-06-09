import { Injectable, inject, signal } from '@angular/core';

import type { Project, Setlist } from '../../../core/models';
import {
  BackgroundWorkService,
  isBackgroundWorkAborted,
} from '../../../core/services/background-work.service';
import { AudioSessionCacheService } from '../../../core/services/audio-session-cache.service';
import { sortSetlistEntriesByOrder } from '../../../core/utils/setlist-order.util';
import { ProjectStorageService } from '../../projects/services/project-storage.service';
import { PlayerPlaybackService } from '../../player/services/player-playback.service';

export type PackPreloadStatus = 'pending' | 'loading' | 'ready' | 'partial' | 'error';

export interface PackWarmProgress {
  loaded: number;
  total: number;
}

const PLAYBACK_HALF_PROGRESS = 0.5;

@Injectable({ providedIn: 'root' })
export class SetlistPreloadService {
  private readonly storage = inject(ProjectStorageService);
  private readonly playback = inject(PlayerPlaybackService);
  private readonly sessionCache = inject(AudioSessionCacheService);
  private readonly backgroundWork = inject(BackgroundWorkService);

  readonly statusByPackId = signal<ReadonlyMap<string, PackPreloadStatus>>(new Map());
  readonly warmProgressByPackId = signal<ReadonlyMap<string, PackWarmProgress>>(new Map());

  private readonly inFlight = new Set<string>();
  private readonly warmPromises = new Map<string, Promise<PackPreloadStatus>>();
  private readonly halfwayWarmTriggered = new Set<string>();
  private activePlaybackSetlistId: string | null = null;
  private activeWarmPackId: string | null = null;
  private activeWarm: { signal: AbortSignal; complete: () => void } | null = null;

  constructor() {
    this.backgroundWork.onCancel(() => this.resetAfterCancel());
  }

  getStatus(packId: string): PackPreloadStatus {
    return this.statusByPackId().get(packId) ?? 'pending';
  }

  isReady(packId: string): boolean {
    return this.getStatus(packId) === 'ready';
  }

  switchToSetlistContext(setlistId: string | null): void {
    if (
      this.activePlaybackSetlistId &&
      (setlistId === null || setlistId !== this.activePlaybackSetlistId)
    ) {
      this.clearPlaybackCache();
    }
    if (setlistId) {
      this.activePlaybackSetlistId = setlistId;
    }
  }

  clearPlaybackCache(): void {
    this.cancelActiveWarm();
    this.activePlaybackSetlistId = null;
    this.halfwayWarmTriggered.clear();
    this.sessionCache.clear();
    this.sessionCache.clearPinnedProjectIds();
    this.statusByPackId.set(new Map());
    this.warmProgressByPackId.set(new Map());
  }

  invalidateSetlistCacheIfActive(setlistId: string): void {
    if (this.activePlaybackSetlistId === setlistId) {
      this.clearPlaybackCache();
    }
  }

  /** Espera la precarga del destino (si sigue en curso) y conserva su caché. */
  async prepareForPackNavigation(targetPackId: string): Promise<void> {
    const pending = this.warmPromises.get(targetPackId);
    if (pending) {
      await pending;
    } else {
      this.cancelActiveWarmExcept(targetPackId);
    }
    this.sessionCache.evictExcept([targetPackId]);
    this.sessionCache.clearPinnedProjectIds();
    this.patchEvictedPackStatuses([targetPackId]);
    await this.syncStatusFromCache(targetPackId);
  }

  warmNextWhenHalfway(
    setlist: Readonly<Setlist>,
    entryIndex: number,
    currentTimeMs: number,
    durationMs: number,
    isPlaying: boolean,
  ): void {
    if (!isPlaying || durationMs <= 0) {
      return;
    }
    if (currentTimeMs < durationMs * PLAYBACK_HALF_PROGRESS) {
      return;
    }

    const key = `${setlist.id}:${entryIndex}`;
    if (this.halfwayWarmTriggered.has(key)) {
      return;
    }

    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const current = entries[entryIndex];
    const next = entries[entryIndex + 1];
    if (!current || !next) {
      return;
    }

    if (this.isReady(next.packId)) {
      this.halfwayWarmTriggered.add(key);
      return;
    }

    this.halfwayWarmTriggered.add(key);
    this.activePlaybackSetlistId = setlist.id;
    void this.warmPackById(next.packId, current.packId);
  }

  warmNextInSetlist(setlist: Readonly<Setlist>, currentEntryIndex: number): void {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const current = entries[currentEntryIndex];
    const next = entries[currentEntryIndex + 1];
    if (next) {
      void this.warmPackById(next.packId, current?.packId);
    }
  }

  warmPackById(
    packId: string,
    keepPackId?: string,
    externalSignal?: AbortSignal,
  ): Promise<PackPreloadStatus> {
    const existing = this.warmPromises.get(packId);
    if (existing) {
      return existing;
    }

    const promise = this.runWarmPackById(packId, keepPackId, externalSignal);
    this.warmPromises.set(packId, promise);
    void promise.finally(() => {
      this.warmPromises.delete(packId);
    });
    return promise;
  }

  pinSetlistPlayback(currentPackId: string, nextPackId: string | null): void {
    this.sessionCache.setPinnedProjectIds(
      nextPackId ? [currentPackId, nextPackId] : [currentPackId],
    );
  }

  clearSetlistPlaybackPins(): void {
    this.sessionCache.clearPinnedProjectIds();
    this.activePlaybackSetlistId = null;
    this.halfwayWarmTriggered.clear();
  }

  private async runWarmPackById(
    packId: string,
    keepPackId?: string,
    externalSignal?: AbortSignal,
  ): Promise<PackPreloadStatus> {
    const project = await this.storage.getProjectById(packId);
    if (!project) {
      this.patchStatus(packId, 'error');
      return 'error';
    }

    if (this.playback.isProjectWarm(project)) {
      this.patchStatus(packId, 'ready');
      return 'ready';
    }

    if (keepPackId) {
      this.sessionCache.clear();
      this.sessionCache.clearPinnedProjectIds();
      this.patchEvictedPackStatuses([packId]);
    }

    this.inFlight.add(packId);
    this.patchStatus(packId, 'loading');
    this.clearWarmProgress(packId);
    const trackHandle = this.backgroundWork.track('cache-warm', 'Precargando siguiente pack…');
    const operation = externalSignal
      ? { signal: externalSignal, complete: () => {} }
      : this.beginWarmOperation(packId);

    try {
      if (operation.signal.aborted) {
        this.patchStatus(packId, 'pending');
        return 'pending';
      }

      const result = await this.playback.warmProjectInCache(
        project,
        operation.signal,
        (progress) => {
          this.patchWarmProgress(packId, progress);
          if (progress.total > 0) {
            trackHandle.setLabel(`Precargando siguiente pack… (${progress.loaded}/${progress.total})`);
          }
        },
      );
      if (operation.signal.aborted) {
        this.patchStatus(packId, 'pending');
        return 'pending';
      }

      return this.applyWarmResult(packId, project, result);
    } catch (error) {
      if (isBackgroundWorkAborted(error)) {
        this.patchStatus(packId, 'pending');
        return 'pending';
      }
      this.patchStatus(packId, 'error');
      return 'error';
    } finally {
      if (!externalSignal) {
        operation.complete();
        if (this.activeWarmPackId === packId) {
          this.activeWarmPackId = null;
          this.activeWarm = null;
        }
      }
      trackHandle.release();
      this.inFlight.delete(packId);
    }
  }

  private applyWarmResult(
    packId: string,
    project: Project,
    result: 'ready' | 'partial' | 'failed',
  ): PackPreloadStatus {
    if (this.playback.isProjectWarm(project)) {
      this.patchStatus(packId, 'ready');
      return 'ready';
    }
    if (result === 'partial' || this.playback.isProjectCached(project)) {
      this.patchStatus(packId, 'partial');
      return 'partial';
    }
    this.patchStatus(packId, 'error');
    return 'error';
  }

  private async syncStatusFromCache(packId: string): Promise<void> {
    const project = await this.storage.getProjectById(packId);
    if (!project) {
      return;
    }
    if (this.playback.isProjectWarm(project)) {
      this.patchStatus(packId, 'ready');
      return;
    }
    if (this.playback.isProjectCached(project)) {
      this.patchStatus(packId, this.playback.isProjectWarm(project) ? 'ready' : 'partial');
      return;
    }
    if (this.getStatus(packId) === 'ready') {
      this.patchStatus(packId, 'pending');
    }
  }

  private beginWarmOperation(packId: string): { signal: AbortSignal; complete: () => void } {
    this.cancelActiveWarmExcept(packId);
    const operation = this.backgroundWork.beginOperation();
    this.activeWarmPackId = packId;
    this.activeWarm = operation;
    return operation;
  }

  private cancelActiveWarmExcept(keepPackId?: string): void {
    if (this.activeWarmPackId && this.activeWarmPackId !== keepPackId && this.activeWarm) {
      this.activeWarm.complete();
      this.activeWarm = null;
      this.activeWarmPackId = null;
    }
    for (const packId of this.inFlight) {
      if (packId === keepPackId) {
        continue;
      }
      if (this.getStatus(packId) === 'loading') {
        this.patchStatus(packId, 'pending');
      }
      this.inFlight.delete(packId);
    }
  }

  private cancelActiveWarm(): void {
    if (this.activeWarm) {
      this.activeWarm.complete();
      this.activeWarm = null;
      this.activeWarmPackId = null;
    }
    for (const packId of this.inFlight) {
      if (this.getStatus(packId) === 'loading') {
        this.patchStatus(packId, 'pending');
      }
    }
    this.inFlight.clear();
  }

  private patchEvictedPackStatuses(keepPackIds: readonly string[]): void {
    const keep = new Set(keepPackIds);
    this.statusByPackId.update((current) => {
      const next = new Map(current);
      for (const [packId, status] of next) {
        if (
          (status === 'ready' || status === 'loading' || status === 'partial') &&
          !keep.has(packId)
        ) {
          next.set(packId, 'pending');
        }
      }
      return next;
    });
  }

  private patchStatus(packId: string, status: PackPreloadStatus): void {
    this.statusByPackId.update((current) => {
      const next = new Map(current);
      next.set(packId, status);
      return next;
    });
  }

  private patchWarmProgress(
    packId: string,
    progress: { loaded: number; total: number },
  ): void {
    this.warmProgressByPackId.update((current) => {
      const next = new Map(current);
      next.set(packId, { loaded: progress.loaded, total: progress.total });
      return next;
    });
  }

  private clearWarmProgress(packId: string): void {
    this.warmProgressByPackId.update((current) => {
      if (!current.has(packId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(packId);
      return next;
    });
  }

  private resetAfterCancel(): void {
    this.cancelActiveWarm();
    this.clearPlaybackCache();
  }
}

