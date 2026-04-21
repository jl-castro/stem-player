/**
 * Motor de audio (Web Audio API): grafos, buffers decodificados, reloj de transporte.
 * Las firmas usan tipos del navegador donde ya aplican; sin implementación aquí.
 */
export interface AudioEnginePort {
  ensureAudioContext(): Promise<void>;

  /** Libera buffers y nodos asociados al proyecto actual. */
  reset(): void;

  /**
   * Registra stems ya decodificados (p. ej. tras `decodeAudioData`).
   * Una implementación futura puede añadir una variante que reciba `ArrayBuffer` y decodifique internamente.
   */
  mountDecodedStems(buffers: ReadonlyMap<string, AudioBuffer>): void;

  startPlayback(offsetMs: number): void;

  pausePlayback(): void;

  haltPlayback(): void;

  /** Reposiciona el transporte; retorno = tiempo efectivo aplicado (ms). */
  setPlayhead(timeMs: number): number;

  getPlayheadMs(): number;

  /** Ganancia lineal 0–1 en la salida maestra del grafo. */
  applyMasterLinearGain(linear: number): void;

  applyStemLinearGain(trackId: string, linear: number): void;

  applyStemMute(trackId: string, muted: boolean): void;

  /** Conjunto vacío = sin modo solo; si no está vacío, solo esas rutas pasan (respetando mute). */
  applySoloSet(soloedTrackIds: ReadonlySet<string>): void;
}
