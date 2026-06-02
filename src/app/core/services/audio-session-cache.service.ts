import { Injectable } from '@angular/core';

/** Buffers decodificados en RAM para no recargar al volver al mismo proyecto en la misma pestaña. */
export interface SessionProjectAudio {
  projectId: string;
  assetKeysFingerprint: string;
  buffers: Map<string, AudioBuffer>;
}

const MAX_CACHED_PROJECTS = 2;

@Injectable({ providedIn: 'root' })
export class AudioSessionCacheService {
  private readonly entries = new Map<string, SessionProjectAudio>();

  get(projectId: string, assetKeysFingerprint: string): Map<string, AudioBuffer> | null {
    const entry = this.entries.get(projectId);
    if (!entry || entry.assetKeysFingerprint !== assetKeysFingerprint) {
      return null;
    }
    return entry.buffers;
  }

  set(projectId: string, assetKeysFingerprint: string, buffers: Map<string, AudioBuffer>): void {
    if (!this.entries.has(projectId) && this.entries.size >= MAX_CACHED_PROJECTS) {
      const oldest = this.entries.keys().next().value;
      if (oldest) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(projectId, { projectId, assetKeysFingerprint, buffers });
  }

  clear(): void {
    this.entries.clear();
  }

  clearIfProject(projectId: string): void {
    this.entries.delete(projectId);
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
