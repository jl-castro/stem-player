import { Injectable, signal } from '@angular/core';

import type { TrackAudioSlot } from '../audio/track-audio-slot';
import type { AudioEnginePort } from '../contracts';

const LOOKAHEAD_SEC = 0.05;
const SEEK_FADE_SEC = 0.025;

export type AudioContextStateKind = AudioContextState | 'closed' | 'interrupted';

function isContextBlocked(state: string): boolean {
  return state === 'suspended' || state === 'interrupted';
}

@Injectable({ providedIn: 'root' })
export class AudioEngineService implements AudioEnginePort {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLinear = 1;

  private readonly slots = new Map<string, TrackAudioSlot>();
  private soloTrackIds = new Set<string>();

  private activeSources: AudioBufferSourceNode[] = [];

  private maxDurationMs = 0;

  private isTransportPlaying = false;
  private playAnchorCtxTime = 0;
  private playheadAtAnchorMs = 0;
  private pausedOrStoppedPlayheadMs = 0;

  private wasPlayingOnSuspend = false;

  /** Estado del AudioContext para UI y recuperación en vivo. */
  readonly contextState = signal<AudioContextStateKind>('closed');

  /** true cuando el contexto no está `running` y hace falta reanudar. */
  readonly needsUserResume = signal(false);

  async ensureAudioContext(): Promise<void> {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        throw new Error('Web Audio API is not available in this environment.');
      }
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterLinear;
      this.masterGain.connect(this.ctx.destination);
      this.bindContextListeners(this.ctx);
      this.contextState.set(this.ctx.state);
    }
    if (isContextBlocked(this.ctx.state)) {
      await this.ctx.resume();
    }
    this.contextState.set(this.ctx.state);
    this.needsUserResume.set(this.ctx.state !== 'running');
  }

  async tryResumeContext(): Promise<boolean> {
    if (!this.ctx) {
      return false;
    }
    try {
      if (isContextBlocked(this.ctx.state)) {
        await this.ctx.resume();
      }
      this.contextState.set(this.ctx.state);
      const ok = this.ctx.state === 'running';
      this.needsUserResume.set(!ok);
      if (ok && this.wasPlayingOnSuspend) {
        this.wasPlayingOnSuspend = false;
        const offset = this.pausedOrStoppedPlayheadMs;
        this.startPlayback(offset);
      }
      return ok;
    } catch {
      this.needsUserResume.set(true);
      return false;
    }
  }

  async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    await this.ensureAudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    return await this.ctx!.decodeAudioData(arrayBuffer.slice(0));
  }

  /** Detiene transporte y desmonta pistas sin cerrar el AudioContext (reutilizable en sesión). */
  unmountStems(): void {
    this.stopScheduledSourcesOnly();
    this.isTransportPlaying = false;
    this.pausedOrStoppedPlayheadMs = 0;
    this.maxDurationMs = 0;
    this.playheadAtAnchorMs = 0;
    this.playAnchorCtxTime = 0;
    this.soloTrackIds.clear();
    this.disconnectAllSlots();
  }

  /** Cierra el contexto y libera todo (cambio de proyecto o fin de sesión). */
  reset(): void {
    this.unmountStems();
    this.teardownContext();
  }

  mountDecodedStems(buffers: ReadonlyMap<string, AudioBuffer>): void {
    if (!this.ctx || !this.masterGain) {
      throw new Error('AudioContext is not initialized; call ensureAudioContext() first.');
    }

    this.disconnectAllSlots();
    this.stopScheduledSourcesOnly();
    this.isTransportPlaying = false;
    this.pausedOrStoppedPlayheadMs = 0;

    let maxSec = 0;
    for (const [trackId, buffer] of buffers) {
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(this.masterGain);

      this.slots.set(trackId, {
        trackId,
        buffer,
        gainNode,
        mix: { volume: 1, muted: false },
      });
      maxSec = Math.max(maxSec, buffer.duration);
    }
    this.maxDurationMs = Math.round(maxSec * 1000);

    for (const slot of this.slots.values()) {
      this.applyEffectiveGain(slot);
    }
  }

  startPlayback(offsetMs: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.slots.size === 0) {
      return;
    }
    if (ctx.state !== 'running') {
      this.wasPlayingOnSuspend = true;
      this.needsUserResume.set(true);
      return;
    }

    this.stopScheduledSourcesOnly();

    const clampedOffset = Math.min(Math.max(0, offsetMs), this.maxDurationMs);
    this.playheadAtAnchorMs = clampedOffset;
    this.playAnchorCtxTime = ctx.currentTime + LOOKAHEAD_SEC;
    this.isTransportPlaying = true;
    this.needsUserResume.set(false);

    for (const slot of this.slots.values()) {
      const offsetSec = clampedOffset / 1000;
      if (offsetSec >= slot.buffer.duration) {
        continue;
      }
      const src = ctx.createBufferSource();
      src.buffer = slot.buffer;
      src.connect(slot.gainNode);
      const playDurationSec = slot.buffer.duration - offsetSec;
      try {
        src.start(this.playAnchorCtxTime, offsetSec, playDurationSec);
      } catch {
        src.disconnect();
        continue;
      }
      this.activeSources.push(src);
    }
  }

  pausePlayback(): void {
    if (!this.ctx) {
      return;
    }
    if (this.isTransportPlaying) {
      this.pausedOrStoppedPlayheadMs = this.computeLivePlayheadMs();
    }
    this.stopScheduledSourcesOnly();
    this.isTransportPlaying = false;
    this.wasPlayingOnSuspend = false;
  }

  haltPlayback(): void {
    this.stopScheduledSourcesOnly();
    this.isTransportPlaying = false;
    this.pausedOrStoppedPlayheadMs = 0;
    this.playheadAtAnchorMs = 0;
    this.playAnchorCtxTime = 0;
    this.wasPlayingOnSuspend = false;
  }

  setPlayhead(timeMs: number): number {
    const clamped = this.clampTimelineMs(timeMs);
    const wasPlaying = this.isTransportPlaying;

    this.applySeekFadeOut();
    this.stopScheduledSourcesOnly();
    this.pausedOrStoppedPlayheadMs = clamped;
    this.playheadAtAnchorMs = clamped;

    if (wasPlaying && this.ctx && this.slots.size > 0) {
      this.startPlayback(clamped);
      this.applySeekFadeIn();
    } else {
      this.isTransportPlaying = false;
    }
    return clamped;
  }

  getPlayheadMs(): number {
    if (!this.ctx) {
      return this.pausedOrStoppedPlayheadMs;
    }
    if (this.isTransportPlaying) {
      return this.computeLivePlayheadMs();
    }
    return this.pausedOrStoppedPlayheadMs;
  }

  applyMasterLinearGain(linear: number): void {
    this.masterLinear = Math.min(Math.max(0, linear), 1);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterLinear, this.ctx.currentTime);
    }
  }

  applyStemLinearGain(trackId: string, linear: number): void {
    const slot = this.slots.get(trackId);
    if (!slot) {
      return;
    }
    slot.mix.volume = Math.min(Math.max(0, linear), 1);
    this.applyEffectiveGain(slot);
  }

  applyStemMute(trackId: string, muted: boolean): void {
    const slot = this.slots.get(trackId);
    if (!slot) {
      return;
    }
    slot.mix.muted = muted;
    this.applyEffectiveGain(slot);
  }

  applySoloSet(soloedTrackIds: ReadonlySet<string>): void {
    this.soloTrackIds = new Set(soloedTrackIds);
    for (const slot of this.slots.values()) {
      this.applyEffectiveGain(slot);
    }
  }

  getMaxDurationMs(): number {
    return this.maxDurationMs;
  }

  isPlaying(): boolean {
    return this.isTransportPlaying;
  }

  /** Contexto activo (llamar tras `ensureAudioContext`). */
  getContext(): AudioContext {
    if (!this.ctx) {
      throw new Error('AudioContext is not initialized.');
    }
    return this.ctx;
  }

  private bindContextListeners(ctx: AudioContext): void {
    ctx.onstatechange = () => {
      this.contextState.set(ctx.state);
      if (isContextBlocked(ctx.state)) {
        if (this.isTransportPlaying) {
          this.wasPlayingOnSuspend = true;
          this.pausedOrStoppedPlayheadMs = this.computeLivePlayheadMs();
          this.stopScheduledSourcesOnly();
          this.isTransportPlaying = false;
        }
        this.needsUserResume.set(true);
      } else if (ctx.state === 'running') {
        this.needsUserResume.set(false);
      }
    };
  }

  private applySeekFadeOut(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterLinear, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + SEEK_FADE_SEC);
  }

  private applySeekFadeIn(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(this.masterLinear, now + SEEK_FADE_SEC);
  }

  private computeLivePlayheadMs(): number {
    if (!this.ctx) {
      return this.pausedOrStoppedPlayheadMs;
    }
    const elapsed = (this.ctx.currentTime - this.playAnchorCtxTime) * 1000;
    return Math.min(this.maxDurationMs, this.playheadAtAnchorMs + elapsed);
  }

  private clampTimelineMs(ms: number): number {
    if (this.maxDurationMs <= 0) {
      return Math.max(0, ms);
    }
    return Math.min(Math.max(0, ms), this.maxDurationMs);
  }

  private stopScheduledSourcesOnly(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.activeSources = [];
  }

  private disconnectAllSlots(): void {
    for (const slot of this.slots.values()) {
      try {
        slot.gainNode.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.slots.clear();
  }

  private teardownContext(): void {
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.disconnect();
      } catch {
        /* ignore */
      }
      this.masterGain = null;
    }

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.contextState.set('closed');
    this.needsUserResume.set(false);
    this.wasPlayingOnSuspend = false;
  }

  private applyEffectiveGain(slot: TrackAudioSlot): void {
    if (!this.ctx) {
      return;
    }
    const soloActive = this.soloTrackIds.size > 0;
    let linear = slot.mix.volume;
    if (slot.mix.muted) {
      linear = 0;
    } else if (soloActive && !this.soloTrackIds.has(slot.trackId)) {
      linear = 0;
    }
    slot.gainNode.gain.setValueAtTime(linear, this.ctx.currentTime);
  }
}
