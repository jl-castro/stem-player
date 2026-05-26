import { Injectable, inject } from '@angular/core';

import type { DecodedPcm } from '../../../core/audio/decoded-pcm';
import type { ProjectStoragePort } from '../../../core/contracts';
import type { Project } from '../../../core/models';
import { sha256HexFromBlob } from '../../../core/utils/blob-hash';
import type { DecodedCacheRow } from '../../../core/storage/db/decoded-cache-row';
import { StemPlayerDatabase } from '../../../core/storage/stem-player.database';
import {
  collectStoredAssetKeys,
  projectToRow,
  rowToProject,
} from '../../../core/storage/mappers/project.mapper';

/**
 * Persistencia local con Dexie (`projects` + `trackAssets`).
 *
 * Flujo típico (crear / adjuntar archivos / persistir):
 * 1. Construir `Project` en memoria (p. ej. `storedAssetKey: null` en cada `StemTrack`).
 * 2. Por cada archivo del usuario: `const key = await storage.saveTrackAsset(project.id, track.id, fileBlob)`
 *    y asignar `track.storedAssetKey = key` (y `mimeType`, `sizeBytes`, `fileName`, etc.).
 * 3. `await storage.saveProject(project)` — valida que existan los blobs para cada `storedAssetKey` y escribe metadatos.
 * 4. Para reproducir más tarde: `const p = await storage.getProjectById(id)` y `const blob = await storage.getTrackAssetBlob(track.storedAssetKey!)`.
 *
 * `deleteProject` borra la fila del proyecto y todos los `trackAssets` con ese `projectId`.
 */
@Injectable({ providedIn: 'root' })
export class ProjectStorageService implements ProjectStoragePort {
  private readonly db = inject(StemPlayerDatabase);

  async listProjects(): Promise<readonly Project[]> {
    const rows = await this.db.projects.orderBy('updatedAt').reverse().toArray();
    return rows.map(rowToProject);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const row = await this.db.projects.get(id);
    return row ? rowToProject(row) : null;
  }

  async saveProject(project: Project): Promise<void> {
    await this.db.transaction('rw', this.db.projects, this.db.trackAssets, async () => {
      const existing = await this.db.projects.get(project.id);
      await this.assertTrackAssetsConsistent(project);

      const previousKeys = existing
        ? collectStoredAssetKeys(rowToProject(existing).tracks)
        : new Set<string>();
      const nextKeys = collectStoredAssetKeys(project.tracks);

      for (const key of previousKeys) {
        if (!nextKeys.has(key)) {
          await this.db.decodedCaches.delete(key);
          await this.db.trackAssets.delete(key);
        }
      }

      await this.db.projects.put(projectToRow(project));
    });
  }

  async renameProject(id: string, name: string): Promise<void> {
    const row = await this.db.projects.get(id);
    if (!row) {
      throw new Error(`Project not found: ${id}`);
    }
    const project = rowToProject(row);
    const now = new Date().toISOString();
    await this.db.projects.put(
      projectToRow({
        ...project,
        name,
        updatedAt: now,
      }),
    );
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.projects, this.db.trackAssets, this.db.decodedCaches, async () => {
      const assets = await this.db.trackAssets.where('projectId').equals(id).toArray();
      for (const asset of assets) {
        await this.db.decodedCaches.delete(asset.key);
      }
      await this.db.trackAssets.where('projectId').equals(id).delete();
      await this.db.projects.delete(id);
    });
  }

  /**
   * Guarda el binario de un stem; devuelve la clave para asignar a `StemTrack.storedAssetKey` antes de `saveProject`.
   * No modifica el `Project` en disco: el caller actualiza el dominio y llama `saveProject`.
   */
  async saveTrackAsset(projectId: string, trackId: string, blob: Blob): Promise<string> {
    const key = crypto.randomUUID();
    const contentHash = await sha256HexFromBlob(blob);
    await this.db.trackAssets.put({
      key,
      projectId,
      trackId,
      blob,
      contentHash,
    });
    return key;
  }

  async getTrackAssetBlob(key: string): Promise<Blob | null> {
    const row = await this.db.trackAssets.get(key);
    return row?.blob ?? null;
  }

  async getTrackAssetContentHash(key: string): Promise<string | null> {
    const row = await this.db.trackAssets.get(key);
    return row?.contentHash ?? null;
  }

  async saveDecodedCache(assetKey: string, contentHash: string, pcm: DecodedPcm): Promise<void> {
    const row: DecodedCacheRow = {
      assetKey,
      contentHash,
      sampleRate: pcm.sampleRate,
      length: pcm.length,
      numberOfChannels: pcm.numberOfChannels,
      channelData: pcm.channelData,
      durationMs: pcm.durationMs,
    };
    await this.db.decodedCaches.put(row);
  }

  async getDecodedCache(
    assetKey: string,
    contentHash: string,
  ): Promise<DecodedPcm | null> {
    const row = await this.db.decodedCaches.get(assetKey);
    if (!row || row.contentHash !== contentHash) {
      return null;
    }
    return {
      sampleRate: row.sampleRate,
      length: row.length,
      numberOfChannels: row.numberOfChannels,
      channelData: row.channelData,
      durationMs: row.durationMs,
    };
  }

  async deleteTrackAsset(key: string): Promise<void> {
    await this.db.transaction('rw', this.db.trackAssets, this.db.decodedCaches, async () => {
      await this.db.decodedCaches.delete(key);
      await this.db.trackAssets.delete(key);
    });
  }

  /** Debe ejecutarse dentro de una transacción `rw` sobre `projects` + `trackAssets`. */
  private async assertTrackAssetsConsistent(project: Project): Promise<void> {
    for (const track of project.tracks) {
      const key = track.storedAssetKey;
      if (!key) {
        continue;
      }
      const asset = await this.db.trackAssets.get(key);
      if (!asset) {
        throw new Error(
          `Missing track asset for storedAssetKey "${key}" (track ${track.id}). Save the blob with saveTrackAsset first.`,
        );
      }
      if (asset.projectId !== project.id || asset.trackId !== track.id) {
        throw new Error(
          `Track asset "${key}" belongs to projectId=${asset.projectId}, trackId=${asset.trackId}; expected projectId=${project.id}, trackId=${track.id}.`,
        );
      }
    }
  }
}
