import Dexie, { type Table } from 'dexie';
import { Injectable } from '@angular/core';

import type { DecodedCacheRow } from './db/decoded-cache-row';
import type { ProjectRow } from './db/project-row';
import type { SetlistRow } from './db/setlist-row';
import type { TrackAssetRow } from './db/track-asset-row';

@Injectable({ providedIn: 'root' })
export class StemPlayerDatabase extends Dexie {
  projects!: Table<ProjectRow, string>;
  trackAssets!: Table<TrackAssetRow, string>;
  decodedCaches!: Table<DecodedCacheRow, string>;
  setlists!: Table<SetlistRow, string>;

  constructor() {
    super('stem-player');

    this.version(1).stores({
      projects: 'id, updatedAt',
      trackAssets: 'key, projectId, trackId',
    });

    this.version(2).stores({
      projects: 'id, updatedAt',
      trackAssets: 'key, projectId, trackId',
      decodedCaches: 'assetKey, contentHash',
    });

    this.version(3).stores({
      projects: 'id, updatedAt',
      trackAssets: 'key, projectId, trackId',
      decodedCaches: 'assetKey, contentHash',
      setlists: 'id, updatedAt',
    });
  }
}
