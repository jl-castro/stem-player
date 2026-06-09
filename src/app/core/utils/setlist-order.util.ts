import type { SetlistEntry } from '../models/setlist.model';

export function sortSetlistEntriesByOrder(
  entries: readonly SetlistEntry[],
): SetlistEntry[] {
  return [...entries].sort((a, b) => a.order - b.order);
}

export function recalculateSetlistEntryOrders(entries: SetlistEntry[]): void {
  entries.forEach((entry, index) => {
    entry.order = index;
  });
}

export function reorderSetlistEntriesInPlace(
  entries: SetlistEntry[],
  previousIndex: number,
  currentIndex: number,
): void {
  if (
    previousIndex < 0 ||
    currentIndex < 0 ||
    previousIndex >= entries.length ||
    currentIndex >= entries.length ||
    previousIndex === currentIndex
  ) {
    return;
  }
  const [moved] = entries.splice(previousIndex, 1);
  if (!moved) {
    return;
  }
  entries.splice(currentIndex, 0, moved);
  recalculateSetlistEntryOrders(entries);
}
