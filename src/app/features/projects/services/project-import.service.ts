import { Injectable, inject } from '@angular/core';

import type { Project, StemTrack } from '../../../core/models';
import { AudioDecodeService } from '../../../core/services/audio-decode.service';
import {
  basenameWithoutExt,
  guessMimeFromFileName,
  isAllowedAudioFile,
  stemColorForIndex,
} from '../../../core/utils/audio-import';
import { sha256HexFromBlob } from '../../../core/utils/blob-hash';
import { ProjectStorageService } from './project-storage.service';

export type ProjectImportPhase = 'decoding' | 'persisting';

@Injectable({ providedIn: 'root' })
export class ProjectImportService {
  private readonly storage = inject(ProjectStorageService);
  private readonly decode = inject(AudioDecodeService);

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
      throw new Error('El nombre del proyecto es obligatorio.');
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

    onProgress?.('decoding', { current: 0, total: files.length });

    const decoded: { file: File; durationMs: number; order: number; pcm: Awaited<ReturnType<AudioDecodeService['decodeBlobToPcm']>>; contentHash: string }[] = [];
    let order = 0;
    let current = 0;

    for (const file of files) {
      current += 1;
      onProgress?.('decoding', { current, total: files.length });
      try {
        const contentHash = await sha256HexFromBlob(file);
        const pcm = await this.decode.decodeBlobToPcm(file);
        decoded.push({ file, durationMs: pcm.durationMs, order, pcm, contentHash });
        order += 1;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        throw new Error(`No se pudo leer "${file.name}". ${detail}`);
      }
    }

    onProgress?.('persisting', { current: 0, total: decoded.length });

    let persistIndex = 0;
    for (const { file, durationMs, order: trackOrder, pcm, contentHash } of decoded) {
      persistIndex += 1;
      onProgress?.('persisting', { current: persistIndex, total: decoded.length });

      const trackId = crypto.randomUUID();
      const key = await this.storage.saveTrackAsset(projectId, trackId, file);
      keysCollected.push(key);
      await this.storage.saveDecodedCache(key, contentHash, pcm);

      tracks.push({
        id: trackId,
        fileName: file.name,
        displayName: basenameWithoutExt(file.name),
        color: stemColorForIndex(trackOrder),
        order: trackOrder,
        durationMs,
        volume: 1,
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
  }
}
