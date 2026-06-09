import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  AUDIO_SESSION_CACHE_BUDGET_BYTES,
  AudioSessionCacheService,
  buildAssetKeysFingerprint,
} from './audio-session-cache.service';

function mockAudioBuffer(length: number, channels = 2): AudioBuffer {
  return {
    length,
    numberOfChannels: channels,
    duration: length / 48_000,
    sampleRate: 48_000,
  } as AudioBuffer;
}

describe('buildAssetKeysFingerprint', () => {
  it('includes track id and asset key in stable order', () => {
    const fp = buildAssetKeysFingerprint([
      { id: 't1', storedAssetKey: 'k1' },
      { id: 't2', storedAssetKey: null },
      { id: 't3', storedAssetKey: 'k2' },
    ]);
    expect(fp).toBe('t1:k1|t3:k2');
  });
});

describe('AudioSessionCacheService', () => {
  /** Presupuesto fijo para tests reproducibles (100 MB). */
  const TEST_BUDGET_BYTES = 100 * 1024 * 1024;
  let cache: AudioSessionCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AUDIO_SESSION_CACHE_BUDGET_BYTES, useValue: TEST_BUDGET_BYTES },
        AudioSessionCacheService,
      ],
    });
    cache = TestBed.inject(AudioSessionCacheService);
  });

  it('returns null when fingerprint does not match', () => {
    const buffers = new Map([['t1', mockAudioBuffer(1000)]]);
    cache.set('p1', 'fp-a', buffers);
    expect(cache.get('p1', 'fp-b')).toBeNull();
  });

  it('evicts least recently used pack when over budget', () => {
    const huge = mockAudioBuffer(13_100_000);
    const small = mockAudioBuffer(100_000);

    cache.set('large-a', 'fp-a', new Map([['t1', huge]]));
    cache.set('small-b', 'fp-b', new Map([['t1', small]]));

    expect(cache.get('large-a', 'fp-a')).toBeNull();
    expect(cache.get('small-b', 'fp-b')?.size).toBe(1);
  });

  it('refreshes LRU order on get', () => {
    const small = mockAudioBuffer(3_000_000);
    const medium = mockAudioBuffer(8_000_000);

    cache.set('pack-a', 'fp-a', new Map([['t1', small]]));
    cache.set('pack-b', 'fp-b', new Map([['t1', small]]));
    expect(cache.get('pack-a', 'fp-a')).not.toBeNull();

    cache.set('pack-c', 'fp-c', new Map([['t1', medium]]));

    expect(cache.get('pack-a', 'fp-a')).not.toBeNull();
    expect(cache.get('pack-b', 'fp-b')).toBeNull();
    expect(cache.get('pack-c', 'fp-c')).not.toBeNull();
  });

  it('clearIfProject removes only that pack', () => {
    cache.set('p1', 'fp-1', new Map([['t1', mockAudioBuffer(100)]]));
    cache.set('p2', 'fp-2', new Map([['t1', mockAudioBuffer(100)]]));
    cache.clearIfProject('p1');
    expect(cache.get('p1', 'fp-1')).toBeNull();
    expect(cache.get('p2', 'fp-2')?.size).toBe(1);
  });

  it('does not evict pinned packs when over budget', () => {
    const huge = mockAudioBuffer(13_100_000);
    const small = mockAudioBuffer(100_000);

    cache.setPinnedProjectIds(['large-a']);
    cache.set('large-a', 'fp-a', new Map([['t1', huge]]));
    cache.set('small-b', 'fp-b', new Map([['t1', small]]));

    expect(cache.get('large-a', 'fp-a')?.size).toBe(1);
    expect(cache.get('small-b', 'fp-b')?.size).toBe(1);
  });
});
