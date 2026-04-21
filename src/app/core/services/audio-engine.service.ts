import { Injectable } from '@angular/core';

import type { AudioEnginePort } from '../contracts';

/** Implementación vacía del motor; más adelante: AudioContext, gains y fuentes por stem. */
@Injectable({ providedIn: 'root' })
export class AudioEngineService implements AudioEnginePort {
  async ensureAudioContext(): Promise<void> {
    return;
  }

  reset(): void {
    return;
  }

  mountDecodedStems(_buffers: ReadonlyMap<string, AudioBuffer>): void {
    return;
  }

  startPlayback(_offsetMs: number): void {
    return;
  }

  pausePlayback(): void {
    return;
  }

  haltPlayback(): void {
    return;
  }

  setPlayhead(timeMs: number): number {
    return timeMs;
  }

  getPlayheadMs(): number {
    return 0;
  }

  applyMasterLinearGain(_linear: number): void {
    return;
  }

  applyStemLinearGain(_trackId: string, _linear: number): void {
    return;
  }

  applyStemMute(_trackId: string, _muted: boolean): void {
    return;
  }

  applySoloSet(_soloedTrackIds: ReadonlySet<string>): void {
    return;
  }
}
