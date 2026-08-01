import { describe, it, expect } from 'vitest';
import { isNearHighImpactEvent } from '../../lib/economicEvents';

// Factory for minimal DbEconomicEvent test fixtures
function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    event_time: '2026-08-05T12:30:00Z',
    title: 'Non-Farm Payrolls',
    currency: 'USD',
    impact: 'high',
    note: null,
    ...overrides,
  };
}

describe('isNearHighImpactEvent', () => {
  it('returns isNear=true when trade is exactly at event time', () => {
    const events = [makeEvent()];
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', events, 30);
    expect(result.isNear).toBe(true);
    expect(result.event?.title).toBe('Non-Farm Payrolls');
  });

  it('returns isNear=true when trade is 29 minutes before event (inside window)', () => {
    const events = [makeEvent()];
    const result = isNearHighImpactEvent('2026-08-05T12:01:00Z', events, 30);
    expect(result.isNear).toBe(true);
  });

  it('returns isNear=true when trade is exactly 30 minutes after event (boundary)', () => {
    const events = [makeEvent()];
    const result = isNearHighImpactEvent('2026-08-05T13:00:00Z', events, 30);
    expect(result.isNear).toBe(true);
  });

  it('returns isNear=false when trade is 31 minutes after event (outside window)', () => {
    const events = [makeEvent()];
    const result = isNearHighImpactEvent('2026-08-05T13:01:00Z', events, 30);
    expect(result.isNear).toBe(false);
  });

  it('ignores medium-impact events', () => {
    const events = [makeEvent({ impact: 'medium' })];
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', events, 30);
    expect(result.isNear).toBe(false);
  });

  it('ignores low-impact events', () => {
    const events = [makeEvent({ impact: 'low' })];
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', events, 30);
    expect(result.isNear).toBe(false);
  });

  it('handles impact casing: "High" (uppercase first letter) still matches', () => {
    const events = [makeEvent({ impact: 'High' })];
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', events, 30);
    expect(result.isNear).toBe(true);
  });

  it('handles impact casing: "HIGH" (all caps) still matches', () => {
    const events = [makeEvent({ impact: 'HIGH' })];
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', events, 30);
    expect(result.isNear).toBe(true);
  });

  it('returns isNear=false for empty events array', () => {
    const result = isNearHighImpactEvent('2026-08-05T12:30:00Z', [], 30);
    expect(result.isNear).toBe(false);
  });

  it('returns isNear=false for null/invalid trade time', () => {
    const events = [makeEvent()];
    const result = isNearHighImpactEvent('not-a-date', events, 30);
    expect(result.isNear).toBe(false);
  });

  it('returns the first matching event when multiple high-impact events exist', () => {
    const events = [
      makeEvent({ id: 'evt-fomc', title: 'FOMC', event_time: '2026-08-05T18:00:00Z' }),
      makeEvent({ id: 'evt-nfp', title: 'NFP', event_time: '2026-08-05T12:30:00Z' }),
    ];
    const result = isNearHighImpactEvent('2026-08-05T18:10:00Z', events, 30);
    expect(result.isNear).toBe(true);
    expect(result.event?.title).toBe('FOMC');
  });
});
