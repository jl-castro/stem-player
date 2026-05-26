import { moveItemInArray } from '@angular/cdk/drag-drop';

import type { StemTrack } from '../models';

/** Orden estable para UI y persistencia (0 = arriba). */
export function sortTracksByOrder(tracks: readonly StemTrack[]): StemTrack[] {
  return [...tracks].sort((a, b) => a.order - b.order);
}

export function recalculateTrackOrders(tracks: StemTrack[]): void {
  tracks.forEach((track, index) => {
    track.order = index;
  });
}

export function reorderTracksInPlace(
  tracks: StemTrack[],
  previousIndex: number,
  currentIndex: number,
): void {
  moveItemInArray(tracks, previousIndex, currentIndex);
  recalculateTrackOrders(tracks);
}
