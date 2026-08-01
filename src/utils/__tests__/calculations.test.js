import { describe, it, expect } from 'vitest';
import { calculatePnL, calculateRR, calculateLotSize, calculatePerformanceStats } from '../calculations';

describe('calculations utility', () => {
  it('calculates Buy and Sell PnL correctly for standard gold lot (100 oz)', () => {
    // Buy: Entry 2400, Exit 2410, Lot 1.0 -> (2410 - 2400) * 1.0 * 100 = $1000
    const buyPnL = calculatePnL('Buy', 2400, 2410, 1.0, 100);
    expect(buyPnL).toBe(1000);

    // Sell: Entry 2410, Exit 2400, Lot 0.5 -> (2410 - 2400) * 0.5 * 100 = $500
    const sellPnL = calculatePnL('Sell', 2410, 2400, 0.5, 100);
    expect(sellPnL).toBe(500);

    // Losing Buy: Entry 2400, Exit 2395, Lot 0.2 -> (2395 - 2400) * 0.2 * 100 = -$100
    const lossPnL = calculatePnL('Buy', 2400, 2395, 0.2, 100);
    expect(lossPnL).toBe(-100);
  });

  it('calculates Risk-Reward Ratio correctly', () => {
    // Entry 2400, SL 2390 (Risk 10), TP 2420 (Reward 20) -> RR 2.0
    const rr = calculateRR('Buy', 2400, 2390, 2420);
    expect(rr).toBe(2.0);

    // Sell: Entry 2400, SL 2410 (Risk 10), TP 2380 (Reward 20) -> RR 2.0
    const sellRR = calculateRR('Sell', 2400, 2410, 2380);
    expect(sellRR).toBe(2.0);
  });

  it('calculates recommended Lot Size dynamically for custom contract sizes', () => {
    // Account $10,000, Risk 1% ($100), Entry 2400, SL 2390 ($10 distance)
    // Formula: 100 / (10 * 100) = 0.10 lot
    const res = calculateLotSize(10000, 1.0, 2400, 2390, 100);
    expect(res.riskAmount).toBe(100);
    expect(res.stopDistance).toBe(10);
    expect(res.lotSize).toBe(0.10);

    // Micro account contract size 10 oz:
    // Formula: 100 / (10 * 10) = 1.00 lot
    const microRes = calculateLotSize(10000, 1.0, 2400, 2390, 10);
    expect(microRes.lotSize).toBe(1.00);
  });

  it('computes performance statistics accurately', () => {
    const mockTrades = [
      { id: '1', timestamp: '2026-07-01T10:00:00Z', pnl: 200, rr: 2.0 },
      { id: '2', timestamp: '2026-07-02T10:00:00Z', pnl: -100, rr: -1.0 },
      { id: '3', timestamp: '2026-07-03T10:00:00Z', pnl: 300, rr: 3.0 },
    ];

    const stats = calculatePerformanceStats(mockTrades, 10000);
    expect(stats.totalPnl).toBe(400);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(67);
    expect(stats.profitFactor).toBe(5.0); // 500 / 100
  });
});
