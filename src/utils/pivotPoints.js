/**
 * Pivot Points Calculation Utility for XAU/USD
 * Supports Classic (Standard), Fibonacci, and Woodie Pivot Point formulas.
 */

/**
 * Calculates Classic Pivot Points (P, R1, R2, R3, S1, S2, S3)
 * @param {number} high - High price of previous period/session
 * @param {number} low - Low price of previous period/session
 * @param {number} close - Close price of previous period/session
 */
export function calculateClassicPivots(high, low, close) {
  if (!high || !low || !close || high <= low) {
    return { p: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 };
  }

  const p = (high + low + close) / 3;
  const r1 = 2 * p - low;
  const s1 = 2 * p - high;
  const r2 = p + (high - low);
  const s2 = p - (high - low);
  const r3 = high + 2 * (p - low);
  const s3 = low - 2 * (high - p);

  return {
    p: parseFloat(p.toFixed(2)),
    r1: parseFloat(r1.toFixed(2)),
    r2: parseFloat(r2.toFixed(2)),
    r3: parseFloat(r3.toFixed(2)),
    s1: parseFloat(s1.toFixed(2)),
    s2: parseFloat(s2.toFixed(2)),
    s3: parseFloat(s3.toFixed(2)),
  };
}

/**
 * Calculates Fibonacci Pivot Points (P, R1, R2, R3, S1, S2, S3)
 */
export function calculateFibonacciPivots(high, low, close) {
  if (!high || !low || !close || high <= low) {
    return { p: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 };
  }

  const p = (high + low + close) / 3;
  const range = high - low;

  const r1 = p + 0.382 * range;
  const r2 = p + 0.618 * range;
  const r3 = p + 1.0 * range;

  const s1 = p - 0.382 * range;
  const s2 = p - 0.618 * range;
  const s3 = p - 1.0 * range;

  return {
    p: parseFloat(p.toFixed(2)),
    r1: parseFloat(r1.toFixed(2)),
    r2: parseFloat(r2.toFixed(2)),
    r3: parseFloat(r3.toFixed(2)),
    s1: parseFloat(s1.toFixed(2)),
    s2: parseFloat(s2.toFixed(2)),
    s3: parseFloat(s3.toFixed(2)),
  };
}

/**
 * Calculates Woodie Pivot Points (P, R1, R2, S1, S2)
 * @param {number} high
 * @param {number} low
 * @param {number} open
 */
export function calculateWoodiePivots(high, low, open) {
  if (!high || !low || !open || high <= low) {
    return { p: 0, r1: 0, r2: 0, s1: 0, s2: 0 };
  }

  const p = (high + low + 2 * open) / 4;
  const r1 = 2 * p - low;
  const s1 = 2 * p - high;
  const r2 = p + (high - low);
  const s2 = p - (high - low);

  return {
    p: parseFloat(p.toFixed(2)),
    r1: parseFloat(r1.toFixed(2)),
    r2: parseFloat(r2.toFixed(2)),
    s1: parseFloat(s1.toFixed(2)),
    s2: parseFloat(s2.toFixed(2)),
  };
}

/**
 * Helper to determine fallback trigger state for script loading
 * @param {boolean} scriptLoaded - whether script load event fired
 * @param {boolean} scriptError - whether script error event fired
 * @param {boolean} timerExpired - whether timeout expired
 */
export function determineFallbackState(scriptLoaded, scriptError, timerExpired) {
  if (scriptError || (timerExpired && !scriptLoaded)) {
    return true; // Fallback active
  }
  return false; // TradingView active
}
