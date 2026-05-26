import { buildAssetKeysFingerprint } from './audio-session-cache.service';

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
