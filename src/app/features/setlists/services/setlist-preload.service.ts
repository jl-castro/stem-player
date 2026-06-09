import { Injectable, inject, signal } from '@angular/core';



import type { Setlist } from '../../../core/models';

import {

  BackgroundWorkService,

  isBackgroundWorkAborted,

} from '../../../core/services/background-work.service';

import { AudioSessionCacheService } from '../../../core/services/audio-session-cache.service';

import { sortSetlistEntriesByOrder } from '../../../core/utils/setlist-order.util';

import { ProjectStorageService } from '../../projects/services/project-storage.service';

import { PlayerPlaybackService } from '../../player/services/player-playback.service';



export type PackPreloadStatus = 'pending' | 'loading' | 'ready' | 'error';



const PLAYBACK_HALF_PROGRESS = 0.5;



@Injectable({ providedIn: 'root' })

export class SetlistPreloadService {

  private readonly storage = inject(ProjectStorageService);

  private readonly playback = inject(PlayerPlaybackService);

  private readonly sessionCache = inject(AudioSessionCacheService);

  private readonly backgroundWork = inject(BackgroundWorkService);



  readonly statusByPackId = signal<ReadonlyMap<string, PackPreloadStatus>>(new Map());



  private readonly inFlight = new Set<string>();

  private readonly halfwayWarmTriggered = new Set<string>();

  private activePlaybackSetlistId: string | null = null;

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

  }



  invalidateSetlistCacheIfActive(setlistId: string): void {

    if (this.activePlaybackSetlistId === setlistId) {

      this.clearPlaybackCache();

    }

  }



  /** Antes de cargar otro pack: cancela precarga en vuelo y deja solo el destino en caché. */

  prepareForPackNavigation(targetPackId: string): void {

    this.cancelActiveWarm();

    this.sessionCache.evictExcept([targetPackId]);

    this.sessionCache.clearPinnedProjectIds();

    this.patchEvictedPackStatuses([targetPackId]);

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



  async warmPackById(

    packId: string,

    keepPackId?: string,

    externalSignal?: AbortSignal,

  ): Promise<PackPreloadStatus> {

    if (this.inFlight.has(packId)) {

      return this.getStatus(packId);

    }



    const project = await this.storage.getProjectById(packId);

    if (!project) {

      this.patchStatus(packId, 'error');

      return 'error';

    }



    if (this.playback.isProjectWarm(project) || this.playback.isProjectCached(project)) {

      this.patchStatus(packId, 'ready');

      return 'ready';

    }



    if (keepPackId) {

      this.sessionCache.evictExcept([keepPackId]);

      this.patchEvictedPackStatuses([keepPackId, packId]);

    }



    this.inFlight.add(packId);

    this.patchStatus(packId, 'loading');

    const trackHandle = this.backgroundWork.track('cache-warm', 'Precargando siguiente pack…');

    const operation = externalSignal

      ? { signal: externalSignal, complete: () => {} }

      : this.beginWarmOperation();

    try {

      if (operation.signal.aborted) {

        this.patchStatus(packId, 'pending');

        return 'pending';

      }

      const result = await this.playback.warmProjectInCache(project, operation.signal);

      if (operation.signal.aborted) {

        this.patchStatus(packId, 'pending');

        return 'pending';

      }

      const status: PackPreloadStatus = result === 'failed' ? 'pending' : 'ready';

      this.patchStatus(packId, status);

      return status;

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

        if (this.activeWarm === operation) {

          this.activeWarm = null;

        }

      }

      trackHandle.release();

      this.inFlight.delete(packId);

    }

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



  private beginWarmOperation(): { signal: AbortSignal; complete: () => void } {

    this.cancelActiveWarm();

    const operation = this.backgroundWork.beginOperation();

    this.activeWarm = operation;

    return operation;

  }



  private cancelActiveWarm(): void {

    if (!this.activeWarm) {

      return;

    }

    this.activeWarm.complete();

    this.activeWarm = null;

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

        if ((status === 'ready' || status === 'loading') && !keep.has(packId)) {

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



  private resetAfterCancel(): void {

    this.cancelActiveWarm();

    this.clearPlaybackCache();

  }

}


