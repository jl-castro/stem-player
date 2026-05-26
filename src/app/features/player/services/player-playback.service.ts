import { Injectable, inject, signal } from '@angular/core';

import type { PlayerPlaybackPort } from '../../../core/contracts';
import type { Project } from '../../../core/models';
import { createInitialPlayerState, type PlayerState } from '../../../core/models';
import { AudioDecodeService } from '../../../core/services/audio-decode.service';
import { AudioEngineService } from '../../../core/services/audio-engine.service';
import {
  AudioSessionCacheService,
  buildAssetKeysFingerprint,
} from '../../../core/services/audio-session-cache.service';
import { sha256HexFromBlob } from '../../../core/utils/blob-hash';
import { estimateDecodedRamBytes, formatBytes, getRamBlockThresholdBytes } from '../../../core/utils/audio-memory';
import {
  recalculateTrackOrders,
  reorderTracksInPlace,
  sortTracksByOrder,
} from '../../../core/utils/track-order.util';
import { ProjectStorageService } from '../../projects/services/project-storage.service';

const LIVE_MODE_KEY = 'stem-player-live-mode';
const MIX_SAVE_DEBOUNCE_MS = 450;

function cloneProject(p: Readonly<Project>): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({ ...t })),
  };
}

export interface LoadProgress {
  loaded: number;
  total: number;
  label: string;
}

export type RamHealthLevel = 'good' | 'warn' | 'danger';

export interface RamHealth {
  level: RamHealthLevel;
  estimateBytes: number;
  thresholdBytes: number;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class PlayerPlaybackService implements PlayerPlaybackPort {
  private readonly engine = inject(AudioEngineService);
  private readonly decode = inject(AudioDecodeService);
  private readonly storage = inject(ProjectStorageService);
  private readonly sessionCache = inject(AudioSessionCacheService);

  readonly state = signal<PlayerState>(createInitialPlayerState());
  readonly loadedProject = signal<Project | null>(null);
  readonly loadSummary = signal<string | null>(null);
  readonly loadProgress = signal<LoadProgress | null>(null);
  readonly ramHealth = signal<RamHealth | null>(null);
  readonly reorderSaving = signal(false);
  readonly reorderError = signal<string | null>(null);
  readonly liveMode = signal(this.readLiveModePreference());

  private project: Project | null = null;
  private loadedStemIds = new Set<string>();
  private loadedProjectId: string | null = null;

  private rafId: number | null = null;
  private readonly boundTick = (): void => this.onTransportTick();
  private mixSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          void this.onPageVisible();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  async loadProject(project: Readonly<Project>): Promise<void> {
    this.stopRafLoop();
    this.loadProgress.set(null);
    this.ramHealth.set(null);
    this.reorderSaving.set(false);
    this.reorderError.set(null);

    const copy = cloneProject(project);
    copy.tracks = sortTracksByOrder(copy.tracks);
    copy.masterVolume = copy.masterVolume ?? 1;

    const fingerprint = buildAssetKeysFingerprint(copy.tracks);
    const sameProject = this.loadedProjectId === project.id;
    const sessionBuffers = this.sessionCache.get(project.id, fingerprint);

    if (!sameProject) {
      this.engine.reset();
      this.loadedProjectId = null;
      this.project = null;
      this.loadedStemIds.clear();
    } else {
      this.engine.unmountStems();
    }

    this.loadedProject.set(null);
    this.loadSummary.set(null);

    const fail = (message: string): void => {
      this.project = null;
      this.loadedStemIds.clear();
      this.loadedProjectId = null;
      this.loadedProject.set(null);
      this.loadSummary.set(null);
      this.loadProgress.set(null);
      this.ramHealth.set(null);
      this.state.set({
        ...createInitialPlayerState(),
        projectId: project.id,
        status: 'error',
        errorMessage: message,
        canPlay: false,
        audioSuspended: false,
      });
    };

    try {
      await this.engine.ensureAudioContext();
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }

    const tracksWithKey = copy.tracks.filter((t) => !!t.storedAssetKey);
    if (copy.tracks.length > 0 && tracksWithKey.length === 0) {
      fail(
        'Este proyecto no tiene archivos de audio guardados. En Proyectos, importa al menos un MP3, WAV o M4A para cada stem.',
      );
      return;
    }

    const durationMap = new Map<string, number>();
    for (const t of copy.tracks) {
      if (t.durationMs > 0) {
        durationMap.set(t.id, t.durationMs);
      }
    }
    const ramEstimate = estimateDecodedRamBytes(copy.tracks, durationMap);
    const ramBlockThreshold = getRamBlockThresholdBytes();
    const aboveRamThreshold = ramEstimate >= ramBlockThreshold;

    const warnThreshold = Math.round(ramBlockThreshold * 0.7);
    const level: RamHealthLevel =
      ramEstimate >= ramBlockThreshold ? 'danger' : ramEstimate >= warnThreshold ? 'warn' : 'good';
    this.ramHealth.set({
      level,
      estimateBytes: ramEstimate,
      thresholdBytes: ramBlockThreshold,
      title: `RAM estimada: ${formatBytes(ramEstimate)} (umbral: ${formatBytes(ramBlockThreshold)})`,
    });

    const buffers = new Map<string, AudioBuffer>();
    const issues: string[] = [];
    const toLoad = copy.tracks.filter((t) => t.storedAssetKey);
    const total = toLoad.length;
    let loaded = 0;

    if (sessionBuffers && sessionBuffers.size > 0) {
      this.loadProgress.set({ loaded: 0, total, label: 'Recuperando audio en memoria…' });
      for (const track of toLoad) {
        const buf = sessionBuffers.get(track.id);
        if (buf) {
          buffers.set(track.id, buf);
          track.durationMs = Math.round(buf.duration * 1000);
        }
        loaded += 1;
        this.loadProgress.set({ loaded, total, label: 'Recuperando audio en memoria…' });
      }
    }

    const missingFromSession = toLoad.filter((t) => !buffers.has(t.id));
    if (missingFromSession.length > 0) {
      await this.engine.ensureAudioContext();

      for (const track of missingFromSession) {
        const key = track.storedAssetKey!;
        loaded = buffers.size;
        this.loadProgress.set({
          loaded,
          total,
          label: `Decodificando ${track.displayName}…`,
        });

        let blob: Blob | null;
        try {
          blob = await this.storage.getTrackAssetBlob(key);
        } catch (e) {
          issues.push(`${track.displayName}: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        if (!blob) {
          issues.push(`${track.displayName}: archivo no encontrado en IndexedDB`);
          continue;
        }

        let contentHash = await this.storage.getTrackAssetContentHash(key);
        if (!contentHash) {
          contentHash = await sha256HexFromBlob(blob);
        } else {
          const liveHash = await sha256HexFromBlob(blob);
          if (liveHash !== contentHash) {
            issues.push(`${track.displayName}: el archivo no coincide con el hash guardado (posible corrupción)`);
            continue;
          }
        }

        try {
          let pcm = await this.storage.getDecodedCache(key, contentHash);
          if (!pcm) {
            pcm = await this.decode.decodeBlobToPcm(blob);
            await this.storage.saveDecodedCache(key, contentHash, pcm);
          }
          const buffer = this.decode.pcmToAudioBuffer(this.engine.getContext(), pcm);
          buffers.set(track.id, buffer);
          track.durationMs = pcm.durationMs;
        } catch {
          issues.push(`${track.displayName}: decodificación fallida`);
        }

        this.loadProgress.set({
          loaded: buffers.size,
          total,
          label: `Decodificando ${track.displayName}…`,
        });
      }
    }

    this.loadProgress.set(null);

    if (buffers.size === 0) {
      const detail = issues.length ? ` Detalle: ${issues.join('; ')}` : '';
      const allBlobMissing =
        tracksWithKey.length > 0 &&
        issues.length === tracksWithKey.length &&
        issues.every((msg) => msg.includes('no encontrado'));
      if (allBlobMissing) {
        fail(
          `No se encontraron los archivos de audio en el almacén local del navegador. Puede que se hayan borrado los datos del sitio o el proyecto esté corrupto.${detail}`,
        );
      } else {
        fail(`No se pudo preparar ningún stem para reproducir.${detail}`);
      }
      return;
    }

    this.sessionCache.set(project.id, fingerprint, buffers);

    try {
      this.engine.mountDecodedStems(buffers);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }

    this.loadedStemIds = new Set(buffers.keys());
    this.loadedProjectId = project.id;

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
    const masterVolume = Math.min(Math.max(0, copy.masterVolume ?? 1), 1);
    copy.masterVolume = masterVolume;

    this.engine.applyMasterLinearGain(masterVolume);
    this.project = copy;
    this.syncLoadedProjectView();

    const allTracksWithAudioLoaded = tracksWithKey.every((t) => buffers.has(t.id));

    const canPlayInLiveMode = allTracksWithAudioLoaded;

    this.state.set({
      ...createInitialPlayerState(),
      projectId: project.id,
      status: 'ready',
      currentTimeMs: 0,
      durationMs,
      masterVolume,
      hasSoloTracks,
      canPlay: this.liveMode() ? canPlayInLiveMode : this.loadedStemIds.size > 0,
      errorMessage: null,
      audioSuspended: this.engine.needsUserResume(),
    });

    const summaryParts: string[] = [];
    if (aboveRamThreshold) {
      summaryParts.push(`Proyecto grande (~${formatBytes(ramEstimate)} en RAM estimada).`);
    }
    const missingKey = copy.tracks.filter((t) => !t.storedAssetKey);
    if (missingKey.length > 0) {
      summaryParts.push(
        `${missingKey.length} pista(s) sin archivo guardado. Importa de nuevo desde Proyectos si falta audio.`,
      );
    }
    if (issues.length > 0 && buffers.size < tracksWithKey.length) {
      summaryParts.push(
        'Algunas pistas no se pudieron cargar. Reimporta o revisa el almacén local del navegador.',
      );
    }
    this.loadSummary.set(summaryParts.length > 0 ? summaryParts.join(' ') : null);
    this.syncAudioSuspendedState();
  }

  toggleLiveMode(): void {
    const next = !this.liveMode();
    this.liveMode.set(next);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(LIVE_MODE_KEY, String(next));
    }
    this.state.update((s) => ({
      ...s,
      canPlay: this.computeCanPlay(this.isFullyLoaded()),
    }));
  }

  async resumeAudio(): Promise<void> {
    const ok = await this.engine.tryResumeContext();
    this.syncAudioSuspendedState();
    if (!ok) {
      this.state.update((s) => ({
        ...s,
        errorMessage: 'No se pudo reactivar el audio. Toca de nuevo Reproducir.',
      }));
    }
  }

  play(): void {
    if (!this.project || !this.state().canPlay) {
      return;
    }
    const { currentTimeMs, durationMs } = this.state();
    const atEnd = durationMs > 0 && currentTimeMs >= durationMs;
    const offsetMs = atEnd ? 0 : currentTimeMs;

    void this.engine
      .ensureAudioContext()
      .then(async () => {
        if (this.engine.needsUserResume()) {
          const ok = await this.engine.tryResumeContext();
          if (!ok) {
            this.syncAudioSuspendedState();
            return;
          }
        }
        this.engine.startPlayback(offsetMs);
        this.state.update((s) => ({
          ...s,
          status: 'playing',
          currentTimeMs: offsetMs,
          errorMessage: null,
          audioSuspended: false,
        }));
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
      .then(async () => {
        if (this.engine.needsUserResume()) {
          await this.engine.tryResumeContext();
        }
        this.engine.startPlayback(0);
        this.state.update((s) => ({ ...s, status: 'playing', errorMessage: null, audioSuspended: false }));
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
    if (this.liveMode()) {
      return;
    }
    const dur = this.state().durationMs;
    const clamped = dur > 0 ? Math.min(Math.max(0, timeMs), dur) : Math.max(0, timeMs);
    const applied = this.engine.setPlayhead(clamped);
    this.state.update((s) => ({ ...s, currentTimeMs: applied }));
  }

  setMasterVolume(linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    this.engine.applyMasterLinearGain(v);
    if (this.project) {
      this.project.masterVolume = v;
    }
    this.state.update((s) => ({ ...s, masterVolume: v }));
    this.scheduleMixPersist();
  }

  setTrackVolume(trackId: string, linear: number): void {
    const v = Math.min(Math.max(0, linear), 1);
    const t = this.project?.tracks.find((x) => x.id === trackId);
    if (t) {
      t.volume = v;
    }
    this.engine.applyStemLinearGain(trackId, v);
    this.syncLoadedProjectView();
    this.scheduleMixPersist();
  }

  toggleTrackMute(trackId: string): void {
    const t = this.project?.tracks.find((x) => x.id === trackId);
    if (!t) {
      return;
    }
    t.muted = !t.muted;
    this.engine.applyStemMute(trackId, t.muted);
    this.syncLoadedProjectView();
    this.scheduleMixPersist();
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
    this.syncLoadedProjectView();
    this.scheduleMixPersist();
  }

  hasStemAudio(trackId: string): boolean {
    return this.loadedStemIds.has(trackId);
  }

  isFullyLoaded(): boolean {
    if (!this.project) {
      return false;
    }
    const withKey = this.project.tracks.filter((t) => t.storedAssetKey);
    return withKey.length > 0 && withKey.every((t) => this.loadedStemIds.has(t.id));
  }

  async reorderTracks(previousIndex: number, currentIndex: number): Promise<void> {
    if (!this.project || previousIndex === currentIndex) {
      return;
    }
    if (this.reorderSaving()) {
      return;
    }

    const snapshot = cloneProject(this.project);
    reorderTracksInPlace(this.project.tracks, previousIndex, currentIndex);
    this.syncLoadedProjectView();

    this.reorderSaving.set(true);
    this.reorderError.set(null);

    const updatedAt = new Date().toISOString();
    this.project.updatedAt = updatedAt;

    try {
      await this.storage.saveProject(cloneProject(this.project));
    } catch (e) {
      this.project = snapshot;
      recalculateTrackOrders(this.project.tracks);
      this.syncLoadedProjectView();
      this.reorderError.set(
        e instanceof Error ? e.message : 'No se pudo guardar el orden de las pistas.',
      );
    } finally {
      this.reorderSaving.set(false);
    }
  }

  clearLoadSummary(): void {
    this.loadSummary.set(null);
    this.reorderError.set(null);
  }

  /** Libera el motor al salir de la app; mantiene caché de buffers en sesión. */
  detachFromPlayer(): void {
    this.stopRafLoop();
    this.engine.unmountStems();
  }

  private readLiveModePreference(): boolean {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }
    return sessionStorage.getItem(LIVE_MODE_KEY) === 'true';
  }

  private computeCanPlay(allTracksWithAudioLoaded: boolean): boolean {
    if (this.liveMode()) {
      return allTracksWithAudioLoaded;
    }
    return this.loadedStemIds.size > 0;
  }

  private async onPageVisible(): Promise<void> {
    if (this.engine.needsUserResume() && this.state().status === 'playing') {
      await this.engine.tryResumeContext();
      this.syncAudioSuspendedState();
    } else if (this.engine.needsUserResume()) {
      this.syncAudioSuspendedState();
    }
  }

  private syncAudioSuspendedState(): void {
    const suspended = this.engine.needsUserResume();
    this.state.update((s) => ({ ...s, audioSuspended: suspended }));
  }

  private scheduleMixPersist(): void {
    if (!this.project) {
      return;
    }
    if (this.mixSaveTimer !== null) {
      clearTimeout(this.mixSaveTimer);
    }
    this.mixSaveTimer = setTimeout(() => {
      this.mixSaveTimer = null;
      void this.persistMix();
    }, MIX_SAVE_DEBOUNCE_MS);
  }

  private async persistMix(): Promise<void> {
    if (!this.project) {
      return;
    }
    const updatedAt = new Date().toISOString();
    this.project.updatedAt = updatedAt;
    try {
      await this.storage.saveProject(cloneProject(this.project));
    } catch {
      /* no bloquear reproducción por fallo de guardado */
    }
  }

  private syncLoadedProjectView(): void {
    this.loadedProject.set(this.project ? cloneProject(this.project) : null);
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

    if (this.engine.needsUserResume()) {
      this.syncAudioSuspendedState();
      this.stopRafLoop();
      this.state.update((s) => ({ ...s, status: 'paused' }));
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
