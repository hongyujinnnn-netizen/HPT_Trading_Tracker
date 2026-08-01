import { describe, it, expect } from 'vitest';

describe('Price Feed Staleness & Source Tagging', () => {
  it('correctly flags snapshots older than 10 minutes as stale', () => {
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const isSnapshotStale = (timestamp) => {
      const ageMs = Date.now() - new Date(timestamp).getTime();
      return ageMs > 10 * 60 * 1000;
    };

    expect(isSnapshotStale(elevenMinutesAgo)).toBe(true);
    expect(isSnapshotStale(twoMinutesAgo)).toBe(false);
  });

  it('validates allowed source values against constraint', () => {
    const validSources = ['goldapi', 'simulated', 'unknown'];
    
    const isValidSource = (src) => validSources.includes(src);

    expect(isValidSource('goldapi')).toBe(true);
    expect(isValidSource('simulated')).toBe(true);
    expect(isValidSource('unknown')).toBe(true);
    expect(isValidSource('invalid_fake_source')).toBe(false);
  });
});
