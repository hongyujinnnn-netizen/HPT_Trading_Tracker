import { describe, it, expect } from 'vitest';
import { getCurrentGoldSession, getActiveSessionName } from '../sessionDetector';

describe('Gold Session Detector', () => {
  it('detects Asian Session during 04:00 UTC on Wednesday', () => {
    // 2026-08-05 is Wednesday, 04:00 UTC
    const wednesdayAsian = new Date('2026-08-05T04:00:00Z');
    const session = getCurrentGoldSession(wednesdayAsian);
    expect(session.name).toBe('Asian session');
    expect(session.status).toBe('active');
  });

  it('detects London / NY Overlap during 14:30 UTC on Wednesday', () => {
    const wednesdayOverlap = new Date('2026-08-05T14:30:00Z');
    const session = getCurrentGoldSession(wednesdayOverlap);
    expect(session.name).toBe('London / NY Overlap');
    expect(session.status).toBe('high_volatility');
  });

  it('detects Weekend Closed on Saturday', () => {
    // 2026-08-01 is Saturday
    const saturday = new Date('2026-08-01T15:00:00Z');
    const session = getCurrentGoldSession(saturday);
    expect(session.name).toBe('Weekend Closed');
    expect(session.status).toBe('closed');
  });

  describe('getActiveSessionName', () => {
    it('returns Asian during 04:00 UTC', () => {
      expect(getActiveSessionName(new Date('2026-08-05T04:00:00Z'))).toBe('Asian');
    });

    it('returns London during 10:00 UTC', () => {
      expect(getActiveSessionName(new Date('2026-08-05T10:00:00Z'))).toBe('London');
    });

    it('returns London Close during 16:30 UTC', () => {
      expect(getActiveSessionName(new Date('2026-08-05T16:30:00Z'))).toBe('London Close');
    });

    it('returns New York during 18:00 UTC', () => {
      expect(getActiveSessionName(new Date('2026-08-05T18:00:00Z'))).toBe('New York');
    });

    it('returns Asian during 22:00 UTC', () => {
      expect(getActiveSessionName(new Date('2026-08-05T22:00:00Z'))).toBe('Asian');
    });
  });
});

