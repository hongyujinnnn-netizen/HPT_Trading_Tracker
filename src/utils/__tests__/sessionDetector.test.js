import { describe, it, expect } from 'vitest';
import { getCurrentGoldSession } from '../sessionDetector';

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
});
