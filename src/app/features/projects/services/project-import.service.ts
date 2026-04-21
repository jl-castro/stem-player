import { Injectable, inject } from '@angular/core';

import type { Project, StemTrack } from '../../../core/models';
import {
  basenameWithoutExt,
  decodeBlobDurationMs,
  guessMimeFromFileName,
  isAllowedAudioFile,
  stemColorForIndex,
} from '../../../core/utils/audio-import';
import { ProjectStorageService } from './project-storage.service';

export type ProjectImportPhase = 'decoding' | 'persisting';

@Injectable({ providedIn: 'root' })
export class ProjectImportService {
  private readonly storage = inject(ProjectStorageService);

  /**
   * Crea proyecto + stems: mide duración real (Web Audio), guarda blobs, luego `saveProject`.
   * Si falla tras guardar blobs, elimina los assets creados en este intento.
   */
  async createProjectFromImportedFiles(
    name: string,
    files: readonly File[],
    onProgress?: (phase: ProjectImportPhase) => void,
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

    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      throw new Error('Tu navegador no permite Web Audio; no se puede medir la duración de los archivos.');
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const keysCollected: string[] = [];
    const tracks: StemTrack[] = [];

    let ctx: AudioContext | null = null;

    try {
      ctx = new Ctx();
      onProgress?.('decoding');

      const decoded: { file: File; durationMs: number; order: number }[] = [];
      let order = 0;
      for (const file of files) {
        let durationMs: number;
        try {
          durationMs = await decodeBlobDurationMs(file, ctx);
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          throw new Error(`No se pudo leer la duración de "${file.name}". ${detail}`);
        }
        decoded.push({ file, durationMs, order });
        order += 1;
      }

      onProgress?.('persisting');
      for (const { file, durationMs, order } of decoded) {
        const trackId = crypto.randomUUID();
        const key = await this.storage.saveTrackAsset(projectId, trackId, file);
        keysCollected.push(key);
        tracks.push({
          id: trackId,
          fileName: file.name,
          displayName: basenameWithoutExt(file.name),
          color: stemColorForIndex(order),
          order,
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
      };

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
    } finally {
      if (ctx) {
        try {
          await ctx.close();
        } catch {
          /* ignore */
        }
      }
    }
  }
}
