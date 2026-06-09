/** Fila IndexedDB: metadatos del setlist + entradas serializadas. */
export interface SetlistRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  entriesJson: string;
}
