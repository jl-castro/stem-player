/**
 * Fila IndexedDB: un blob por clave (`key` === `StemTrack.storedAssetKey` en dominio).
 */
export interface TrackAssetRow {
  key: string;
  projectId: string;
  trackId: string;
  blob: Blob;
  /** SHA-256 hex del blob; ausente en filas creadas antes de la migración v2. */
  contentHash?: string;
}
