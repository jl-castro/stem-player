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

/**
 * Umbral base de bloqueo (~900 MB) pensado para escritorio.
 * En tiempo de ejecución se ajusta con `getRamBlockThresholdBytes` según `navigator.deviceMemory`.
 */
export const RAM_BLOCK_BYTES = 900 * 1024 * 1024;

/** Devuelve el umbral de RAM según la memoria del dispositivo reportada por el navegador. */
export function getRamBlockThresholdBytes(): number {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof dm !== 'number' || !Number.isFinite(dm) || dm <= 0) {
    return RAM_BLOCK_BYTES;
  }
  if (dm <= 1) return 300 * 1024 * 1024;   // móviles con 1 GB
  if (dm <= 2) return 450 * 1024 * 1024;   // móviles con 2 GB
  if (dm <= 4) return 650 * 1024 * 1024;   // gama media (4 GB)
  if (dm <= 8) return 900 * 1024 * 1024;   // gama alta (8 GB)
  return 1_200 * 1024 * 1024;              // escritorio con mucha RAM
}

/** Presupuesto de RAM para la caché de sesión (AudioBuffer en memoria). */
export function getSessionCacheBudgetBytes(): number {
  return Math.floor(getRamBlockThresholdBytes() * 0.45);
}

/** Valor bruto de `navigator.deviceMemory` (GB), si el navegador lo expone. */
export function getReportedDeviceMemoryGb(): number | undefined {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof dm !== 'number' || !Number.isFinite(dm) || dm <= 0) {
    return undefined;
  }
  return dm;
}

/** Log de diagnóstico: memoria reportada por el navegador y presupuestos usados por la app. */
export function logAudioMemoryBudget(): void {
  if (typeof console === 'undefined') {
    return;
  }
  const deviceMemoryGb = getReportedDeviceMemoryGb();
  const thresholdBytes = getRamBlockThresholdBytes();
  const cacheBudgetBytes = getSessionCacheBudgetBytes();
  const deviceMemoryLabel =
    deviceMemoryGb !== undefined ? `${deviceMemoryGb} GB` : 'no disponible (usa umbral por defecto)';

  console.info(
    '[stem-player] Memoria del navegador: deviceMemory=%s | umbral app=%s | caché precarga=%s',
    deviceMemoryLabel,
    formatBytes(thresholdBytes),
    formatBytes(cacheBudgetBytes),
  );
}

/** Estima bytes de `AudioBuffer` decodificados (float32 por canal). */
/** Menos paralelismo en packs con muchas pistas para no duplicar PCM + AudioBuffer en RAM. */
export function pickTrackLoadConcurrency(trackCount: number, maxDefault = 4): number {
  if (trackCount > 16) {
    return 1;
  }
  if (trackCount > 8) {
    return 2;
  }
  if (trackCount > 4) {
    return 3;
  }
  return maxDefault;
}

export function estimateAudioBuffersRamBytes(buffers: ReadonlyMap<string, AudioBuffer>): number {
  let total = 0;
  for (const buffer of buffers.values()) {
    total += buffer.length * buffer.numberOfChannels * BYTES_PER_SAMPLE;
  }
  return total;
}
