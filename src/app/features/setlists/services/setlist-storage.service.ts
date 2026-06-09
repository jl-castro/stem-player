import { Injectable, inject } from '@angular/core';

import type { Setlist, SetlistEntry } from '../../../core/models/setlist.model';
import { sortSetlistEntriesByOrder } from '../../../core/utils/setlist-order.util';
import { StemPlayerDatabase } from '../../../core/storage/stem-player.database';
import {
  rowToSetlist,
  setlistToRow,
} from '../../../core/storage/mappers/setlist.mapper';

@Injectable({ providedIn: 'root' })
export class SetlistStorageService {
  private readonly db = inject(StemPlayerDatabase);

  async listSetlists(): Promise<readonly Setlist[]> {
    const rows = await this.db.setlists.orderBy('updatedAt').reverse().toArray();
    return rows.map((row) => {
      const setlist = rowToSetlist(row);
      return {
        ...setlist,
        entries: sortSetlistEntriesByOrder(setlist.entries),
      };
    });
  }

  async getSetlistById(id: string): Promise<Setlist | null> {
    const row = await this.db.setlists.get(id);
    if (!row) {
      return null;
    }
    const setlist = rowToSetlist(row);
    return {
      ...setlist,
      entries: sortSetlistEntriesByOrder(setlist.entries),
    };
  }

  async createSetlist(name: string): Promise<Setlist> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('El nombre del setlist es obligatorio.');
    }
    const now = new Date().toISOString();
    const setlist: Setlist = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    await this.db.setlists.put(setlistToRow(setlist));
    return setlist;
  }

  async renameSetlist(id: string, name: string): Promise<void> {
    const row = await this.db.setlists.get(id);
    if (!row) {
      throw new Error('Setlist no encontrado.');
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('El nombre no puede estar vacío.');
    }
    const setlist = rowToSetlist(row);
    await this.db.setlists.put(
      setlistToRow({
        ...setlist,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  async saveSetlistEntries(id: string, entries: readonly SetlistEntry[]): Promise<Setlist> {
    const row = await this.db.setlists.get(id);
    if (!row) {
      throw new Error('Setlist no encontrado.');
    }
    const setlist = rowToSetlist(row);
    const sorted = sortSetlistEntriesByOrder(entries);
    const updated: Setlist = {
      ...setlist,
      entries: sorted,
      updatedAt: new Date().toISOString(),
    };
    await this.db.setlists.put(setlistToRow(updated));
    return updated;
  }

  async deleteSetlist(id: string): Promise<void> {
    await this.db.setlists.delete(id);
  }
}
