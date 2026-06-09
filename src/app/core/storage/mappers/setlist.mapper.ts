import type { Setlist, SetlistEntry } from '../../models/setlist.model';
import type { SetlistRow } from '../db/setlist-row';

export function setlistToRow(setlist: Setlist): SetlistRow {
  return {
    id: setlist.id,
    name: setlist.name,
    createdAt: setlist.createdAt,
    updatedAt: setlist.updatedAt,
    entriesJson: JSON.stringify(setlist.entries),
  };
}

export function rowToSetlist(row: SetlistRow): Setlist {
  let entries: SetlistEntry[] = [];
  try {
    const parsed = JSON.parse(row.entriesJson) as unknown;
    if (Array.isArray(parsed)) {
      entries = parsed as SetlistEntry[];
    }
  } catch {
    entries = [];
  }
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entries,
  };
}
