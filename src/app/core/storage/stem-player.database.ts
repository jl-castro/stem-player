import Dexie, { type Table } from 'dexie';
import { Injectable } from '@angular/core';

import type { ProjectRow } from './db/project-row';
import type { TrackAssetRow } from './db/track-asset-row';

@Injectable({ providedIn: 'root' })
export class StemPlayerDatabase extends Dexie {
  projects!: Table<ProjectRow, string>;
  trackAssets!: Table<TrackAssetRow, string>;

  constructor() {
    super('stem-player');

    this.version(1).stores({
      projects: 'id, updatedAt',
      trackAssets: 'key, projectId, trackId',
    });
  }
}
