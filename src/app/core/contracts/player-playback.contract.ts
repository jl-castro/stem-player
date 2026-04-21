import type { Project } from '../models';

/**
 * Fachada del reproductor: estado de dominio + acciones de usuario; delega en `AudioEnginePort` y almacén cuando existan.
 */
export interface PlayerPlaybackPort {
  loadProject(project: Readonly<Project>): Promise<void>;

  play(): void;

  pause(): void;

  stop(): void;

  restart(): void;

  seekTo(timeMs: number): void;

  /** `linear` en rango 0–1. */
  setMasterVolume(linear: number): void;

  setTrackVolume(trackId: string, linear: number): void;

  toggleTrackMute(trackId: string): void;

  toggleTrackSolo(trackId: string): void;
}
