import { inject, Injectable, InjectionToken } from '@angular/core';

import {
  estimateAudioBuffersRamBytes,
  getSessionCacheBudgetBytes,
} from '../utils/audio-memory';

/** Presupuesto de RAM para la caché de sesión; sobreescribible en tests. */
export const AUDIO_SESSION_CACHE_BUDGET_BYTES = new InjectionToken<number>(
  'AUDIO_SESSION_CACHE_BUDGET_BYTES',
  {
    providedIn: 'root',
    factory: () => getSessionCacheBudgetBytes(),
  },
);

/** Buffers decodificados en RAM para no recargar al volver al mismo pack en la misma pestaña. */
export interface SessionProjectAudio {
  projectId: string;
  assetKeysFingerprint: string;
  buffers: Map<string, AudioBuffer>;
  estimatedBytes: number;
}

@Injectable({ providedIn: 'root' })
export class AudioSessionCacheService {
  /** LRU: la entrada más antigua está al inicio del Map. */
  private readonly entries = new Map<string, SessionProjectAudio>();
  private cachedBytes = 0;
  private readonly budgetBytes = inject(AUDIO_SESSION_CACHE_BUDGET_BYTES);
  /** Packs del setlist en show: no se expulsan por LRU hasta cambiar de setlist. */
  private pinnedProjectIds = new Set<string>();

  get(projectId: string, assetKeysFingerprint: string): Map<string, AudioBuffer> | null {
    const entry = this.entries.get(projectId);
    if (!entry || entry.assetKeysFingerprint !== assetKeysFingerprint) {
      return null;
    }
    this.touchEntry(projectId, entry);
    return entry.buffers;
  }

  set(projectId: string, assetKeysFingerprint: string, buffers: Map<string, AudioBuffer>): void {
    const estimatedBytes = estimateAudioBuffersRamBytes(buffers);
    this.removeEntry(projectId);

    while (
      this.cachedBytes + estimatedBytes > this.budgetBytes &&
      this.entries.size > 0
    ) {
      const sizeBefore = this.entries.size;
      this.evictOldest();
      if (this.entries.size === sizeBefore) {
        break;
      }
    }

    this.entries.set(projectId, {
      projectId,
      assetKeysFingerprint,
      buffers,
      estimatedBytes,
    });
    this.cachedBytes += estimatedBytes;
  }

  clear(): void {
    this.entries.clear();
    this.cachedBytes = 0;
  }

  clearIfProject(projectId: string): void {
    this.removeEntry(projectId);
  }

  /** Fija packs de un setlist para que Precargar no expulse el primero al cargar el segundo. */
  setPinnedProjectIds(projectIds: readonly string[]): void {
    this.pinnedProjectIds = new Set(projectIds);
  }

  clearPinnedProjectIds(): void {
    this.pinnedProjectIds.clear();
  }

  isPinned(projectId: string): boolean {
    return this.pinnedProjectIds.has(projectId);
  }

  private touchEntry(projectId: string, entry: SessionProjectAudio): void {
    this.entries.delete(projectId);
    this.entries.set(projectId, entry);
  }

  private removeEntry(projectId: string): void {
    const existing = this.entries.get(projectId);
    if (!existing) {
      return;
    }
    this.entries.delete(projectId);
    this.cachedBytes -= existing.estimatedBytes;
  }

  private evictOldest(): void {
    for (const projectId of this.entries.keys()) {
      if (this.pinnedProjectIds.has(projectId)) {
        continue;
      }
      this.removeEntry(projectId);
      return;
    }
  }
}

/** Huella estable de las claves de assets cargados (orden de pistas). */
export function buildAssetKeysFingerprint(
  tracks: readonly { id: string; storedAssetKey: string | null }[],
): string {
  return tracks
    .filter((t) => t.storedAssetKey)
    .map((t) => `${t.id}:${t.storedAssetKey}`)
    .join('|');
}
