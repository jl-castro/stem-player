import type { StemTrack } from '../models';
import { estimateDecodedRamBytes, formatBytes, getRamBlockThresholdBytes, RAM_BLOCK_BYTES } from './audio-memory';

describe('audio-memory', () => {
  it('estimateDecodedRamBytes sums track durations', () => {
    const tracks: StemTrack[] = [
      {
        id: 'a',
        durationMs: 60_000,
        fileName: '',
        displayName: '',
        color: '',
        order: 0,
        volume: 1,
        pan: 'center',
        muted: false,
        solo: false,
        mimeType: '',
        sizeBytes: 0,
        storedAssetKey: 'k1',
      },
    ];
    const bytes = estimateDecodedRamBytes(tracks, new Map([['a', 60_000]]), 48_000);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBe(60 * 48_000 * 2 * 4);
  });

  it('formatBytes uses human units', () => {
    expect(formatBytes(512)).toContain('B');
    expect(formatBytes(2048)).toContain('KB');
    expect(formatBytes(3 * 1024 * 1024)).toContain('MB');
  });

  it('defines block threshold', () => {
    expect(RAM_BLOCK_BYTES).toBeGreaterThan(0);
    // En entorno de tests (sin deviceMemory disponible) cae en el valor base.
    expect(getRamBlockThresholdBytes()).toBeGreaterThan(0);
  });
});
