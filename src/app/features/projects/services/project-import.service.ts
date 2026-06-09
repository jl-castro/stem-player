import { Injectable, inject } from '@angular/core';

import { releaseDecodedPcm } from '../../../core/audio/decoded-pcm';
import type { Project, StemTrack } from '../../../core/models';
import { AudioDecodeService } from '../../../core/services/audio-decode.service';
import {
  BackgroundWorkAbortedError,
  BackgroundWorkService,
  isBackgroundWorkAborted,
} from '../../../core/services/background-work.service';
import { AudioSessionCacheService } from '../../../core/services/audio-session-cache.service';
import {
  basenameWithoutExt,
  guessMimeFromFileName,
  isAllowedAudioFile,
  stemColorForIndex,
} from '../../../core/utils/audio-import';
import { sha256HexFromBlob } from '../../../core/utils/blob-hash';
import { recalculateTrackOrders, sortTracksByOrder } from '../../../core/utils/track-order.util';
import { ProjectStorageService } from './project-storage.service';

export type ProjectImportPhase = 'decoding' | 'persisting';

@Injectable({ providedIn: 'root' })
export class ProjectImportService {
  private readonly storage = inject(ProjectStorageService);
  private readonly decode = inject(AudioDecodeService);
  private readonly sessionCache = inject(AudioSessionCacheService);
  private readonly backgroundWork = inject(BackgroundWorkService);

  /**
   * Crea proyecto + stems: decodifica en worker (duración + caché PCM), guarda blobs, luego `saveProject`.
   */
  async createProjectFromImportedFiles(
    name: string,
    files: readonly File[],
    onProgress?: (phase: ProjectImportPhase, detail?: { current: number; total: number }) => void,
  ): Promise<Project> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('El nombre del pack es obligatorio.');
    }
    if (!files.length) {
      throw new Error('Selecciona al menos un archivo de audio.');
    }

    const invalid = files.filter((f) => !isAllowedAudioFile(f));
    if (invalid.length > 0) {
      throw new Error(
        `Solo MP3, WAV y M4A. Archivos no válidos: ${invalid.map((f) => f.name).join(', ')}`,
      );
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const keysCollected: string[] = [];
    const tracks: StemTrack[] = [];
    const total = files.length;

    const operation = this.backgroundWork.beginOperation();
    const trackHandle = this.backgroundWork.track('import', importProgressLabel('decoding', 0, total));

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        const current = index + 1;
        throwIfAborted(operation.signal);

        trackHandle.setLabel(importProgressLabel('decoding', current, total));
        onProgress?.('decoding', { current, total });

        let contentHash: string;
        let pcm: Awaited<ReturnType<AudioDecodeService['decodeBlobToPcm']>>;
        try {
          contentHash = await sha256HexFromBlob(file);
          throwIfAborted(operation.signal);
          pcm = await this.decode.decodeBlobToPcm(file);
        } catch (e) {
          if (isBackgroundWorkAborted(e)) {
            throw e;
          }
          const detail = e instanceof Error ? e.message : String(e);
          throw new Error(`No se pudo leer "${file.name}". ${detail}`);
        }

        throwIfAborted(operation.signal);
        trackHandle.setLabel(importProgressLabel('persisting', current, total));
        onProgress?.('persisting', { current, total });

        const trackId = crypto.randomUUID();
        const key = await this.storage.saveTrackAsset(projectId, trackId, file);
        keysCollected.push(key);
        await this.storage.saveDecodedCache(key, contentHash, pcm);
        const durationMs = pcm.durationMs;
        releaseDecodedPcm(pcm);

        tracks.push({
          id: trackId,
          fileName: file.name,
          displayName: basenameWithoutExt(file.name),
          color: stemColorForIndex(index),
          order: index,
          durationMs,
          volume: 1,
          pan: 'center',
          muted: false,
          solo: false,
          mimeType: file.type || guessMimeFromFileName(file.name),
          sizeBytes: file.size,
          storedAssetKey: key,
        });
      }

      const project: Project = {
        id: projectId,
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        tracks,
        masterVolume: 1,
      };

      try {
        await this.storage.saveProject(project);
        return project;
      } catch (e) {
        for (const key of keysCollected) {
          try {
            await this.storage.deleteTrackAsset(key);
          } catch {
            /* ignore cleanup errors */
          }
        }
        throw e;
      }
    } catch (error) {
      if (isBackgroundWorkAborted(error)) {
        for (const key of keysCollected) {
          try {
            await this.storage.deleteTrackAsset(key);
          } catch {
            /* ignore cleanup errors */
          }
        }
        throw new Error('Importación cancelada');
      }
      throw error;
    } finally {
      operation.complete();
      trackHandle.release();
    }
  }

  /** Añade stems a un proyecto existente (decodifica, guarda blobs y actualiza metadatos). */
  async addTracksToProject(
    projectId: string,
    files: readonly File[],
    onProgress?: (phase: ProjectImportPhase, detail?: { current: number; total: number }) => void,
  ): Promise<Project> {
    if (!files.length) {
      throw new Error('Selecciona al menos un archivo de audio.');
    }

    const existing = await this.storage.getProjectById(projectId);
    if (!existing) {
      throw new Error('Pack no encontrado.');
    }

    const invalid = files.filter((f) => !isAllowedAudioFile(f));
    if (invalid.length > 0) {
      throw new Error(
        `Solo MP3, WAV y M4A. Archivos no válidos: ${invalid.map((f) => f.name).join(', ')}`,
      );
    }

    const keysCollected: string[] = [];
    const addedTracks: StemTrack[] = [];
    let order = existing.tracks.length;
    const total = files.length;

    const operation = this.backgroundWork.beginOperation();
    const trackHandle = this.backgroundWork.track('import', addTracksProgressLabel('decoding', 0, total));

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        const current = index + 1;
        throwIfAborted(operation.signal);

        trackHandle.setLabel(addTracksProgressLabel('decoding', current, total));
        onProgress?.('decoding', { current, total });

        let contentHash: string;
        let pcm: Awaited<ReturnType<AudioDecodeService['decodeBlobToPcm']>>;
        try {
          contentHash = await sha256HexFromBlob(file);
          throwIfAborted(operation.signal);
          pcm = await this.decode.decodeBlobToPcm(file);
        } catch (e) {
          if (isBackgroundWorkAborted(e)) {
            throw e;
          }
          const detail = e instanceof Error ? e.message : String(e);
          throw new Error(`No se pudo leer "${file.name}". ${detail}`);
        }

        throwIfAborted(operation.signal);
        trackHandle.setLabel(addTracksProgressLabel('persisting', current, total));
        onProgress?.('persisting', { current, total });

        const trackId = crypto.randomUUID();
        const key = await this.storage.saveTrackAsset(projectId, trackId, file);
        keysCollected.push(key);
        await this.storage.saveDecodedCache(key, contentHash, pcm);

        const durationMs = pcm.durationMs;
        releaseDecodedPcm(pcm);

        addedTracks.push({
          id: trackId,
          fileName: file.name,
          displayName: basenameWithoutExt(file.name),
          color: stemColorForIndex(order),
          order,
          durationMs,
          volume: 1,
          pan: 'center',
          muted: false,
          solo: false,
          mimeType: file.type || guessMimeFromFileName(file.name),
          sizeBytes: file.size,
          storedAssetKey: key,
        });
        order += 1;
      }

      const tracks = sortTracksByOrder([
        ...existing.tracks.map((t) => ({ ...t })),
        ...addedTracks,
      ]);
      recalculateTrackOrders(tracks);

      const project: Project = {
        ...existing,
        tracks,
        updatedAt: new Date().toISOString(),
      };

      try {
        await this.storage.saveProject(project);
        this.sessionCache.clearIfProject(projectId);
        return project;
      } catch (e) {
        for (const key of keysCollected) {
          try {
            await this.storage.deleteTrackAsset(key);
          } catch {
            /* ignore cleanup errors */
          }
        }
        throw e;
      }
    } catch (error) {
      if (isBackgroundWorkAborted(error)) {
        for (const key of keysCollected) {
          try {
            await this.storage.deleteTrackAsset(key);
          } catch {
            /* ignore cleanup errors */
          }
        }
        throw new Error('Importación cancelada');
      }
      throw error;
    } finally {
      operation.complete();
      trackHandle.release();
    }
  }

  /** Quita una pista del proyecto y borra su audio local asociado. */
  async removeTrackFromProject(projectId: string, trackId: string): Promise<Project> {
    const existing = await this.storage.getProjectById(projectId);
    if (!existing) {
      throw new Error('Pack no encontrado.');
    }

    const track = existing.tracks.find((t) => t.id === trackId);
    if (!track) {
      throw new Error('Pista no encontrada.');
    }

    const remaining = existing.tracks.filter((t) => t.id !== trackId);
    const remainingWithAudio = remaining.filter((t) => t.storedAssetKey);
    if (remainingWithAudio.length === 0) {
      throw new Error('Debe quedar al menos una pista con audio.');
    }

    const tracks = remaining.map((t) => ({ ...t }));
    recalculateTrackOrders(tracks);

    const project: Project = {
      ...existing,
      tracks,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveProject(project);
    this.sessionCache.clearIfProject(projectId);
    return project;
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new BackgroundWorkAbortedError();
  }
}

function importProgressLabel(_phase: ProjectImportPhase, current: number, total: number): string {
  return total > 0 ? `Importando pack… (${current}/${total})` : 'Importando pack…';
}

function addTracksProgressLabel(_phase: ProjectImportPhase, current: number, total: number): string {
  return total > 0 ? `Añadiendo pistas… (${current}/${total})` : 'Añadiendo pistas…';
}
