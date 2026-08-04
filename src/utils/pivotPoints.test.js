import { describe, it, expect } from 'vitest';
import {
  calculateClassicPivots,
  calculateFibonacciPivots,
  calculateWoodiePivots,
  determineFallbackState,
} from './pivotPoints';

describe('Pivot Points Math Utility', () => {
  const high = 2750.0;
  const low = 2710.0;
  const close = 2735.0;
  const open = 2720.0;

  it('calculates Classic Pivot Points correctly', () => {
    const pivots = calculateClassicPivots(high, low, close);
    // P = (2750 + 2710 + 2735) / 3 = 2731.67
    expect(pivots.p).toBe(2731.67);
    // R1 = 2 * 2731.6667 - 2710 = 2753.33
    expect(pivots.r1).toBe(2753.33);
    // S1 = 2 * 2731.6667 - 2750 = 2713.33
    expect(pivots.s1).toBe(2713.33);
    // R2 = P + (H - L) = 2731.67 + 40 = 2771.67
    expect(pivots.r2).toBe(2771.67);
    // S2 = P - (H - L) = 2731.67 - 40 = 2691.67
    expect(pivots.s2).toBe(2691.67);
  });

  it('handles invalid inputs gracefully', () => {
    const invalid = calculateClassicPivots(0, 100, 50);
    expect(invalid.p).toBe(0);
    expect(invalid.r1).toBe(0);

    const reversed = calculateClassicPivots(2700, 2750, 2720);
    expect(reversed.p).toBe(0);
  });

  it('calculates Fibonacci Pivot Points correctly', () => {
    const fibPivots = calculateFibonacciPivots(high, low, close);
    expect(fibPivots.p).toBe(2731.67); // (2750+2710+2735)/3
    // R1 = 2731.6667 + 0.382 * 40 = 2746.95
    expect(fibPivots.r1).toBe(2746.95);
    // S1 = 2731.6667 - 0.382 * 40 = 2716.39
    expect(fibPivots.s1).toBe(2716.39);
  });

  it('calculates Woodie Pivot Points correctly', () => {
    const woodie = calculateWoodiePivots(high, low, open);
    // P = (2750 + 2710 + 2 * 2720) / 4 = 2725.00
    expect(woodie.p).toBe(2725.0);
    // R1 = 2 * 2725 - 2710 = 2740.00
    expect(woodie.r1).toBe(2740.0);
  });
});

describe('Chart Fallback Trigger Logic', () => {
  it('keeps TradingView active when script loads cleanly within time limit', () => {
    const isFallback = determineFallbackState(true, false, false);
    expect(isFallback).toBe(false);
  });

  it('activates fallback if script encounters network error', () => {
    const isFallback = determineFallbackState(false, true, false);
    expect(isFallback).toBe(true);
  });

  it('activates fallback if 5s timeout expires without script loading (ad-blocker case)', () => {
    const isFallback = determineFallbackState(false, false, true);
    expect(isFallback).toBe(true);
  });
});
