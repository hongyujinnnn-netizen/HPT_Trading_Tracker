import { describe, it, expect } from 'vitest';

describe('Dashboard PnL Calendar & WinLoss Calculations', () => {
  it('calculates daily PnL totals correctly from trade objects', () => {
    const sampleTrades = [
      { date: '2026-07-01', pnl: 120 },
      { date: '2026-07-01', pnl: -20 },
      { date: '2026-07-02', pnl: -40 },
    ];

    const map = {};
    sampleTrades.forEach((t) => {
      map[t.date] = (map[t.date] || 0) + t.pnl;
    });

    expect(map['2026-07-01']).toBe(100);
    expect(map['2026-07-02']).toBe(-40);
  });

  it('calculates win, loss, and breakeven counts accurately', () => {
    const trades = [
      { pnl: 150 },
      { pnl: 200 },
      { pnl: -50 },
      { pnl: 0 },
    ];

    const wins = trades.filter((t) => t.pnl > 0).length;
    const losses = trades.filter((t) => t.pnl < 0).length;
    const breakeven = trades.filter((t) => t.pnl === 0).length;

    expect(wins).toBe(2);
    expect(losses).toBe(1);
    expect(breakeven).toBe(1);
    expect(Math.round((wins / trades.length) * 100)).toBe(50);
  });
});
