import type { StemTrack } from './stem-track.model';

/** Proyecto de ensayo: stems locales y marcas de tiempo ISO 8601 para listado y ordenación. */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracks: StemTrack[];
}
