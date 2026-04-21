import { Injectable, inject } from '@angular/core';

import type { Project, StemTrack } from '../../../core/models';
import { ProjectStorageService } from './project-storage.service';

const STEM_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

function pickStemColor(index: number): string {
  return STEM_PALETTE[index % STEM_PALETTE.length] ?? '#6b7280';
}

function basenameWithoutExt(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '');
  const without = base.replace(/\.[^.]+$/i, '');
  return without.trim() || base.trim() || 'Pista';
}

function guessMimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lower.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  return 'application/octet-stream';
}

function isAllowedAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'mp3' || ext === 'wav' || ext === 'm4a';
}

@Injectable({ providedIn: 'root' })
export class ProjectImportService {
  private readonly storage = inject(ProjectStorageService);

  /**
   * Crea proyecto + stems: guarda blobs, luego `saveProject`.
   * Si falla `saveProject`, elimina los assets creados en este intento.
   */
  async createProjectFromImportedFiles(name: string, files: readonly File[]): Promise<Project> {
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

    try {
      let order = 0;
      for (const file of files) {
        const trackId = crypto.randomUUID();
        const key = await this.storage.saveTrackAsset(projectId, trackId, file);
        keysCollected.push(key);
        tracks.push({
          id: trackId,
          fileName: file.name,
          displayName: basenameWithoutExt(file.name),
          color: pickStemColor(order),
          order,
          durationMs: 0,
          volume: 1,
          muted: false,
          solo: false,
          mimeType: file.type || guessMimeFromFileName(file.name),
          sizeBytes: file.size,
          storedAssetKey: key,
        });
        order += 1;
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
    }
  }
}
