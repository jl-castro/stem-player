/**
 * PCM en caché para evitar re-decodificar al abrir el reproductor.
 * `assetKey` === `StemTrack.storedAssetKey`.
 */
export interface DecodedCacheRow {
  assetKey: string;
  contentHash: string;
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  channelData: Float32Array[];
  durationMs: number;
}
