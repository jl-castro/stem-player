import type { StemTrack } from '../models';

const BYTES_PER_SAMPLE = 4;

/** Estima RAM si todos los stems se decodifican a float32 (canales × muestras × 4). */
export function estimateDecodedRamBytes(
  tracks: readonly StemTrack[],
  durationMsByTrackId: ReadonlyMap<string, number>,
  sampleRate = 48_000,
): number {
  let total = 0;
  for (const track of tracks) {
    const durationMs = durationMsByTrackId.get(track.id) ?? track.durationMs;
    if (durationMs <= 0) {
      continue;
    }
    const samples = Math.ceil((durationMs / 1000) * sampleRate);
    const channels = 2;
    total += samples * channels * BYTES_PER_SAMPLE;
  }
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Por encima de este umbral no se permite cargar el proyecto (evitar crash de pestaña). */
export const RAM_BLOCK_BYTES = 900 * 1024 * 1024;
