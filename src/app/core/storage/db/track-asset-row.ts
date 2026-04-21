/**
 * Fila IndexedDB: un blob por clave (`key` === `StemTrack.storedAssetKey` en dominio).
 */
export interface TrackAssetRow {
  key: string;
  projectId: string;
  trackId: string;
  blob: Blob;
}
