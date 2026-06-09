import { Injectable, inject, signal } from '@angular/core';

import type { Setlist } from '../../../core/models';
import { AudioSessionCacheService } from '../../../core/services/audio-session-cache.service';
import { sortSetlistEntriesByOrder } from '../../../core/utils/setlist-order.util';
import { ProjectStorageService } from '../../projects/services/project-storage.service';
import { PlayerPlaybackService } from '../../player/services/player-playback.service';

export type PackPreloadStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface SetlistPreloadProgress {
  loaded: number;
  total: number;
  label: string;
}

export interface WarmSetlistResult {
  readyCount: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SetlistPreloadService {
  private readonly storage = inject(ProjectStorageService);
  private readonly playback = inject(PlayerPlaybackService);
  private readonly sessionCache = inject(AudioSessionCacheService);

  readonly statusByPackId = signal<ReadonlyMap<string, PackPreloadStatus>>(new Map());
  readonly setlistPreloadProgress = signal<SetlistPreloadProgress | null>(null);

  private readonly inFlight = new Set<string>();

  getStatus(packId: string): PackPreloadStatus {
    return this.statusByPackId().get(packId) ?? 'pending';
  }

  isReady(packId: string): boolean {
    return this.getStatus(packId) === 'ready';
  }

  refreshStatusForPack(packId: string, project?: Awaited<ReturnType<ProjectStorageService['getProjectById']>>): void {
    void this.syncPackStatus(packId, project);
  }

  async warmPackById(packId: string): Promise<PackPreloadStatus> {
    if (this.inFlight.has(packId)) {
      return this.getStatus(packId);
    }

    const project = await this.storage.getProjectById(packId);
    if (!project) {
      this.patchStatus(packId, 'error');
      return 'error';
    }

    if (this.playback.isProjectWarm(project)) {
      this.patchStatus(packId, 'ready');
      return 'ready';
    }

    this.inFlight.add(packId);
    this.patchStatus(packId, 'loading');
    try {
      const result = await this.playback.warmProjectInCache(project);
      const status: PackPreloadStatus =
        result === 'failed' ? 'error' : 'ready';
      this.patchStatus(packId, status);
      return status;
    } catch {
      this.patchStatus(packId, 'error');
      return 'error';
    } finally {
      this.inFlight.delete(packId);
    }
  }

  warmNextInSetlist(setlist: Readonly<Setlist>, currentEntryIndex: number): void {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const next = entries[currentEntryIndex + 1];
    if (next) {
      void this.warmPackById(next.packId);
    }
  }

  async warmSetlist(setlist: Readonly<Setlist>): Promise<WarmSetlistResult> {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    if (entries.length === 0) {
      return { readyCount: 0, total: 0 };
    }

    const packIds = entries.map((e) => e.packId);
    this.sessionCache.setPinnedProjectIds(packIds);

    const total = entries.length;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!;
      this.setlistPreloadProgress.set({
        loaded: i,
        total,
        label: `Precargando pack ${i + 1} de ${total}…`,
      });
      await this.warmPackById(entry.packId);
    }

    const readyCount = await this.refreshAllPackStatuses(packIds);
    this.setlistPreloadProgress.set({
      loaded: readyCount,
      total,
      label:
        readyCount === total
          ? 'Setlist listo'
          : `${readyCount} de ${total} packs en memoria`,
    });

    return { readyCount, total };
  }

  clearSetlistPreloadProgress(): void {
    this.setlistPreloadProgress.set(null);
  }

  preloadCompleteMessage(result: WarmSetlistResult): string {
    if (result.total === 0) {
      return '';
    }
    if (result.readyCount === result.total) {
      return 'Setlist listo para el show';
    }
    return `${result.readyCount} de ${result.total} packs en memoria (el resto cargará al reproducir)`;
  }

  private async refreshAllPackStatuses(packIds: readonly string[]): Promise<number> {
    let readyCount = 0;
    for (const packId of packIds) {
      await this.syncPackStatus(packId);
      if (this.getStatus(packId) === 'ready') {
        readyCount += 1;
      }
    }
    return readyCount;
  }

  private async syncPackStatus(
    packId: string,
    project?: Awaited<ReturnType<ProjectStorageService['getProjectById']>>,
  ): Promise<void> {
    const p = project ?? (await this.storage.getProjectById(packId));
    if (!p) {
      this.patchStatus(packId, 'error');
      return;
    }
    this.patchStatus(packId, this.playback.isProjectWarm(p) ? 'ready' : 'pending');
  }

  private patchStatus(packId: string, status: PackPreloadStatus): void {
    this.statusByPackId.update((current) => {
      const next = new Map(current);
      next.set(packId, status);
      return next;
    });
  }
}
