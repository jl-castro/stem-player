import { mapWithConcurrency } from './async-pool';

describe('mapWithConcurrency', () => {
  it('returns empty array for empty input', async () => {
    const results = await mapWithConcurrency([], 4, async () => 1);
    expect(results).toEqual([]);
  });

  it('preserves result order', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('limits concurrent executions', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return true;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
