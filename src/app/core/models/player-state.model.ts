/** Estado de transporte del reproductor (sin acoplar a Web Audio). */
export type PlaybackStatus =
  | 'idle'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error';

/** Snapshot de UI / orquestación del player; el motor de audio no lo usa directamente. */
export interface PlayerState {
  projectId: string | null;
  status: PlaybackStatus;
  currentTimeMs: number;
  durationMs: number;
  /** Ganancia maestra lineal 0–1. */
  masterVolume: number;
  hasSoloTracks: boolean;
  canPlay: boolean;
  errorMessage: string | null;
}

export function createInitialPlayerState(): PlayerState {
  return {
    projectId: null,
    status: 'idle',
    currentTimeMs: 0,
    durationMs: 0,
    masterVolume: 1,
    hasSoloTracks: false,
    canPlay: false,
    errorMessage: null,
  };
}
