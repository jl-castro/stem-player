import type { Project, StemTrack } from '../../models';
import type { ProjectRow } from '../db/project-row';

export function projectToRow(project: Project): ProjectRow {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    tracksJson: JSON.stringify(project.tracks),
  };
}

export function rowToProject(row: ProjectRow): Project {
  let tracks: StemTrack[];
  try {
    tracks = JSON.parse(row.tracksJson) as StemTrack[];
  } catch {
    tracks = [];
  }
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tracks,
  };
}

export function collectStoredAssetKeys(tracks: readonly StemTrack[]): Set<string> {
  const keys = new Set<string>();
  for (const t of tracks) {
    if (t.storedAssetKey) {
      keys.add(t.storedAssetKey);
    }
  }
  return keys;
}
