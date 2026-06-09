import { Injectable, inject, signal } from '@angular/core';

import type { Setlist } from '../../../core/models';
import { sortSetlistEntriesByOrder } from '../../../core/utils/setlist-order.util';
import { ProjectStorageService } from '../../projects/services/project-storage.service';
import { PlayerPlaybackService } from '../../player/services/player-playback.service';

export type PackPreloadStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface SetlistPreloadProgress {
  loaded: number;
  total: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class SetlistPreloadService {
  private readonly storage = inject(ProjectStorageService);
  private readonly playback = inject(PlayerPlaybackService);

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

  async warmSetlist(setlist: Readonly<Setlist>): Promise<void> {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    if (entries.length === 0) {
      return;
    }

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
    this.setlistPreloadProgress.set({
      loaded: total,
      total,
      label: 'Setlist listo',
    });
  }

  clearSetlistPreloadProgress(): void {
    this.setlistPreloadProgress.set(null);
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
