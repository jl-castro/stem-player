/** Entrada ordenada de un setlist; referencia un pack existente. */
export interface SetlistEntry {
  id: string;
  packId: string;
  order: number;
}

/** Repertorio ordenado para show/ensayo. */
export interface Setlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  entries: SetlistEntry[];
}
