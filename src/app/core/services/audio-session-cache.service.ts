import { Injectable } from '@angular/core';

/** Buffers decodificados en RAM para no recargar al volver al mismo proyecto en la misma pestaña. */
export interface SessionProjectAudio {
  projectId: string;
  assetKeysFingerprint: string;
  buffers: Map<string, AudioBuffer>;
}

@Injectable({ providedIn: 'root' })
export class AudioSessionCacheService {
  private entry: SessionProjectAudio | null = null;

  get(projectId: string, assetKeysFingerprint: string): Map<string, AudioBuffer> | null {
    if (
      !this.entry ||
      this.entry.projectId !== projectId ||
      this.entry.assetKeysFingerprint !== assetKeysFingerprint
    ) {
      return null;
    }
    return this.entry.buffers;
  }

  set(projectId: string, assetKeysFingerprint: string, buffers: Map<string, AudioBuffer>): void {
    this.entry = { projectId, assetKeysFingerprint, buffers };
  }

  clear(): void {
    this.entry = null;
  }

  clearIfProject(projectId: string): void {
    if (this.entry?.projectId === projectId) {
      this.entry = null;
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
