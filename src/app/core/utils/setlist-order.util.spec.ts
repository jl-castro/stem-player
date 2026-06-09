import {
  recalculateSetlistEntryOrders,
  reorderSetlistEntriesInPlace,
  sortSetlistEntriesByOrder,
} from './setlist-order.util';

describe('setlist-order.util', () => {
  it('sortSetlistEntriesByOrder sorts by order field', () => {
    const sorted = sortSetlistEntriesByOrder([
      { id: 'b', packId: 'p2', order: 1 },
      { id: 'a', packId: 'p1', order: 0 },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('reorderSetlistEntriesInPlace updates order indexes', () => {
    const entries = [
      { id: 'a', packId: 'p1', order: 0 },
      { id: 'b', packId: 'p2', order: 1 },
      { id: 'c', packId: 'p3', order: 2 },
    ];
    reorderSetlistEntriesInPlace(entries, 0, 2);
    expect(entries.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    recalculateSetlistEntryOrders(entries);
    expect(entries.map((e) => e.order)).toEqual([0, 1, 2]);
  });
});
