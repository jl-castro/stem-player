import { Injectable, inject, signal } from '@angular/core';

import type { PlayerPlaybackPort } from '../../../core/contracts';
import { AudioEngineService } from '../../../core/services/audio-engine.service';
import type { Project } from '../../../core/models';
import { createInitialPlayerState, type PlayerState } from '../../../core/models';

/**
 * Orquestación del player; enlaza estado de dominio con el motor sin reglas de negocio pesadas aún.
 */
@Injectable({ providedIn: 'root' })
export class PlayerPlaybackService implements PlayerPlaybackPort {
  private readonly engine = inject(AudioEngineService);

  readonly state = signal<PlayerState>(createInitialPlayerState());

  async loadProject(project: Readonly<Project>): Promise<void> {
    this.engine.reset();
    const durationMs = project.tracks.length
      ? Math.max(...project.tracks.map((t) => t.durationMs))
      : 0;
    const hasSoloTracks = project.tracks.some((t) => t.solo);
    this.state.set({
      ...createInitialPlayerState(),
      projectId: project.id,
      status: 'ready',
      durationMs,
      hasSoloTracks,
      canPlay: project.tracks.length > 0,
    });
  }

  play(): void {
    this.engine.startPlayback(this.state().currentTimeMs);
  }

  pause(): void {
    this.engine.pausePlayback();
  }

  stop(): void {
    this.engine.haltPlayback();
  }

  restart(): void {
    this.engine.haltPlayback();
    this.engine.startPlayback(0);
  }

  seekTo(timeMs: number): void {
    const clamped = Math.min(Math.max(0, timeMs), this.state().durationMs);
    this.engine.setPlayhead(clamped);
    this.state.update((prev) => ({ ...prev, currentTimeMs: clamped }));
  }

  setMasterVolume(linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    this.engine.applyMasterLinearGain(v);
    this.state.update((prev) => ({ ...prev, masterVolume: v }));
  }

  setTrackVolume(trackId: string, linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    this.engine.applyStemLinearGain(trackId, v);
  }

  toggleTrackMute(_trackId: string): void {}

  toggleTrackSolo(_trackId: string): void {}
}
