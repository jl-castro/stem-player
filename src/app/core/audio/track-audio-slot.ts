import type { StemTrack } from '../models';

/** Grafo fijo por stem entre fuentes efímeras y el bus maestro. */
export interface TrackAudioSlot {
  trackId: string;
  buffer: AudioBuffer;
  gainNode: GainNode;
  /** Copia local de volumen/mute; solo global vía `applySoloSet` en el motor. */
  mix: Pick<StemTrack, 'volume' | 'muted'>;
}
