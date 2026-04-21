import { Injectable, inject, signal } from '@angular/core';

import type { PlayerPlaybackPort } from '../../../core/contracts';
import type { Project } from '../../../core/models';
import { createInitialPlayerState, type PlayerState } from '../../../core/models';
import { AudioEngineService } from '../../../core/services/audio-engine.service';
import { ProjectStorageService } from '../../projects/services/project-storage.service';

function cloneProject(p: Readonly<Project>): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({ ...t })),
  };
}

@Injectable({ providedIn: 'root' })
export class PlayerPlaybackService implements PlayerPlaybackPort {
  private readonly engine = inject(AudioEngineService);
  private readonly storage = inject(ProjectStorageService);

  readonly state = signal<PlayerState>(createInitialPlayerState());

  /** Copia mutable del proyecto cargado (volúmenes, mute, solo) alineada con el motor. */
  private project: Project | null = null;

  /** Stems realmente montados en el motor (evita que un `solo` sobre pista no cargada silencie todo). */
  private loadedStemIds = new Set<string>();

  private rafId: number | null = null;
  private readonly boundTick = (): void => this.onTransportTick();

  async loadProject(project: Readonly<Project>): Promise<void> {
    this.stopRafLoop();
    this.engine.reset();

    const fail = (message: string): void => {
      this.project = null;
      this.loadedStemIds.clear();
      this.state.set({
        ...createInitialPlayerState(),
        projectId: project.id,
        status: 'error',
        errorMessage: message,
        canPlay: false,
      });
    };

    try {
      await this.engine.ensureAudioContext();
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }

    const copy = cloneProject(project);
    const buffers = new Map<string, AudioBuffer>();
    const issues: string[] = [];

    for (const track of copy.tracks) {
      const key = track.storedAssetKey;
      if (!key) {
        continue;
      }
      let blob: Blob | null;
      try {
        blob = await this.storage.getTrackAssetBlob(key);
      } catch (e) {
        issues.push(`${track.displayName}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      if (!blob) {
        issues.push(`${track.displayName}: archivo no encontrado`);
        continue;
      }
      try {
        const buffer = await this.engine.decodeBlob(blob);
        buffers.set(track.id, buffer);
        track.durationMs = Math.round(buffer.duration * 1000);
      } catch (e) {
        issues.push(`${track.displayName}: decodificación fallida`);
      }
    }

    if (buffers.size === 0) {
      const hint = issues.length ? ` (${issues.join('; ')})` : '';
      fail(`No hay stems reproducibles${hint}`);
      return;
    }

    try {
      this.engine.mountDecodedStems(buffers);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }

    this.loadedStemIds = new Set(buffers.keys());

    for (const t of copy.tracks) {
      if (!buffers.has(t.id)) {
        continue;
      }
      this.engine.applyStemLinearGain(t.id, t.volume);
      this.engine.applyStemMute(t.id, t.muted);
    }
    this.applySoloToEngine();

    const durationMs = this.engine.getMaxDurationMs();
    const hasSoloTracks = copy.tracks.some((t) => t.solo);

    this.engine.applyMasterLinearGain(1);
    this.project = copy;
    this.state.set({
      ...createInitialPlayerState(),
      projectId: project.id,
      status: 'ready',
      currentTimeMs: 0,
      durationMs,
      masterVolume: 1,
      hasSoloTracks,
      canPlay: true,
      errorMessage: null,
    });
  }

  play(): void {
    if (!this.project || !this.state().canPlay) {
      return;
    }
    void this.engine
      .ensureAudioContext()
      .then(() => {
        this.engine.startPlayback(this.state().currentTimeMs);
        this.state.update((s) => ({ ...s, status: 'playing', errorMessage: null }));
        this.startRafLoop();
      })
      .catch((e) => {
        this.state.update((s) => ({
          ...s,
          status: 'error',
          errorMessage: e instanceof Error ? e.message : String(e),
        }));
      });
  }

  pause(): void {
    this.engine.pausePlayback();
    this.stopRafLoop();
    const t = this.engine.getPlayheadMs();
    this.state.update((s) => ({
      ...s,
      status: 'paused',
      currentTimeMs: t,
    }));
  }

  stop(): void {
    this.engine.haltPlayback();
    this.stopRafLoop();
    this.state.update((s) => ({
      ...s,
      status: 'stopped',
      currentTimeMs: 0,
    }));
  }

  restart(): void {
    this.engine.haltPlayback();
    this.stopRafLoop();
    this.state.update((s) => ({ ...s, currentTimeMs: 0 }));
    void this.engine
      .ensureAudioContext()
      .then(() => {
        this.engine.startPlayback(0);
        this.state.update((s) => ({ ...s, status: 'playing', errorMessage: null }));
        this.startRafLoop();
      })
      .catch((e) => {
        this.state.update((s) => ({
          ...s,
          status: 'error',
          errorMessage: e instanceof Error ? e.message : String(e),
        }));
      });
  }

  seekTo(timeMs: number): void {
    const dur = this.state().durationMs;
    const clamped = dur > 0 ? Math.min(Math.max(0, timeMs), dur) : Math.max(0, timeMs);
    const applied = this.engine.setPlayhead(clamped);
    this.state.update((s) => ({ ...s, currentTimeMs: applied }));
  }

  setMasterVolume(linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    this.engine.applyMasterLinearGain(v);
    this.state.update((s) => ({ ...s, masterVolume: v }));
  }

  setTrackVolume(trackId: string, linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    const t = this.project?.tracks.find((x) => x.id === trackId);
    if (t) {
      t.volume = v;
    }
    this.engine.applyStemLinearGain(trackId, v);
  }

  toggleTrackMute(trackId: string): void {
    const t = this.project?.tracks.find((x) => x.id === trackId);
    if (!t) {
      return;
    }
    t.muted = !t.muted;
    this.engine.applyStemMute(trackId, t.muted);
  }

  toggleTrackSolo(trackId: string): void {
    const t = this.project?.tracks.find((x) => x.id === trackId);
    if (!t) {
      return;
    }
    t.solo = !t.solo;
    this.applySoloToEngine();
    const hasSolo = this.project!.tracks.some((x) => x.solo);
    this.state.update((s) => ({ ...s, hasSoloTracks: hasSolo }));
  }

  private applySoloToEngine(): void {
    if (!this.project) {
      return;
    }
    const soloIds = new Set(
      this.project.tracks.filter((t) => t.solo && this.loadedStemIds.has(t.id)).map((t) => t.id),
    );
    this.engine.applySoloSet(soloIds);
  }

  private startRafLoop(): void {
    this.stopRafLoop();
    this.rafId = requestAnimationFrame(this.boundTick);
  }

  private stopRafLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private onTransportTick(): void {
    if (this.state().status !== 'playing') {
      this.stopRafLoop();
      return;
    }
    const dur = this.state().durationMs;
    const ms = this.engine.getPlayheadMs();
    const clamped = dur > 0 ? Math.min(ms, dur) : ms;
    this.state.update((s) => ({ ...s, currentTimeMs: clamped }));

    if (dur > 0 && clamped >= dur - 1) {
      this.engine.pausePlayback();
      this.state.update((s) => ({
        ...s,
        status: 'paused',
        currentTimeMs: dur,
      }));
      this.stopRafLoop();
      return;
    }

    this.rafId = requestAnimationFrame(this.boundTick);
  }
}
