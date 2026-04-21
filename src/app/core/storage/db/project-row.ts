/**
 * Fila IndexedDB: metadatos del proyecto + stems serializados (sin binarios).
 * El dominio `Project` se reconstruye vía `project.mapper`.
 */
export interface ProjectRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracksJson: string;
}
