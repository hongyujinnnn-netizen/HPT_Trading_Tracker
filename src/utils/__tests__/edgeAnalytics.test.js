import { describe, it, expect } from 'vitest';
import {
  calculateRollingWinRate,
  calculateRMultipleDistribution,
  calculateUnderwaterDrawdown,
  calculateExpectancy,
  calculateSharpeRatio,
  calculateTimeOfDayMatrix,
  calculatePsychologyStats,
} from '../edgeAnalytics';

describe('edgeAnalytics engine', () => {
  const sampleTrades = [
    { id: 1, date: '2026-08-01', pnl: 250, rr: 2.0, entryPrice: 2700, stopLoss: 2690, lotSize: 0.25, emotion: 'Planned' },
    { id: 2, date: '2026-08-02', pnl: 150, rr: 1.5, entryPrice: 2710, stopLoss: 2700, lotSize: 0.15, emotion: 'Planned' },
    { id: 3, date: '2026-08-03', pnl: -100, rr: -1.0, entryPrice: 2720, stopLoss: 2710, lotSize: 0.1, emotion: 'FOMO' },
    { id: 4, date: '2026-08-04', pnl: 300, rr: 3.0, entryPrice: 2715, stopLoss: 2705, lotSize: 0.3, emotion: 'Planned' },
    { id: 5, date: '2026-08-05', pnl: -120, rr: -1.0, entryPrice: 2730, stopLoss: 2718, lotSize: 0.1, emotion: 'Revenge Trade' },
    { id: 6, date: '2026-08-06', pnl: -100, rr: -1.0, entryPrice: 2725, stopLoss: 2715, lotSize: 0.1, emotion: 'FOMO' },
  ];

  describe('calculateRollingWinRate', () => {
    it('calculates rolling win rate and detects baseline dip', () => {
      const result = calculateRollingWinRate(sampleTrades, 4, 60);
      expect(result.points.length).toBe(6);
      expect(result.baseline).toBe(60);
      // Trade 1-4: 3 wins / 4 = 75%
      // Trade 5: window is trades 2,3,4,5 -> wins are 2,4 -> 2/4 = 50% (< 60%)
      // Trade 6: window is trades 3,4,5,6 -> wins is 4 -> 1/4 = 25% (< 60%)
      expect(result.points[5].rollingWinRate).toBe(25);
      expect(result.hasAlert).toBe(true); // 2 consecutive readings below 60%
    });

    it('handles empty trades gracefully', () => {
      const result = calculateRollingWinRate([], 20, 50);
      expect(result.points).toEqual([]);
      expect(result.hasAlert).toBe(false);
    });
  });

  describe('calculateRMultipleDistribution', () => {
    it('buckets trades into risk units and calculates skewness', () => {
      const result = calculateRMultipleDistribution(sampleTrades);
      expect(result.buckets.length).toBeGreaterThan(0);
      expect(result.avgWinR).toBeGreaterThan(0);
      expect(result.avgLossR).toBeLessThan(0);
      expect(typeof result.skewness).toBe('number');
      expect(result.skewnessType).toBeDefined();
    });
  });

  describe('calculateUnderwaterDrawdown', () => {
    it('computes underwater equity curve and flags circuit breaker', () => {
      // Create severe losing trades that drop equity > 10%
      const losingTrades = [
        { id: 1, date: '2026-08-01', pnl: 500 },
        { id: 2, date: '2026-08-02', pnl: -1500 }, // Peak was 10500, drops to 9000 -> ~14.28% DD
      ];
      const result = calculateUnderwaterDrawdown(losingTrades, 10000, 10);
      expect(result.maxDrawdownPct).toBeGreaterThan(10);
      expect(result.circuitBreakerHit).toBe(true);
      expect(result.points.length).toBe(2);
      expect(result.episodes.length).toBeGreaterThan(0);
    });
  });

  describe('calculateExpectancy', () => {
    it('accurately computes dollar expectancy and sizing recommendation', () => {
      const result = calculateExpectancy(sampleTrades);
      // Wins: 250, 150, 300 (sum=700, count=3, avgWin=233.33, winRate=50%)
      // Losses: 100, 120, 100 (sum=320, count=3, avgLoss=106.67, lossRate=50%)
      // Expectancy: (0.5 * 233.33) - (0.5 * 106.67) = 116.67 - 53.33 = ~63.33
      expect(result.expectancy).toBeCloseTo(63.33, 0);
      expect(result.winRatePct).toBe(50);
      expect(result.lossRatePct).toBe(50);
      expect(result.sizingMultiplier).toBeDefined();
    });
  });

  describe('calculateSharpeRatio', () => {
    it('enforces 30+ trades guardrail to filter retail noise', () => {
      const lowSampleResult = calculateSharpeRatio(sampleTrades, 0.02, 30);
      expect(lowSampleResult.isSampleBuilding).toBe(true);
      expect(lowSampleResult.sharpeRatio).toBeNull();
      expect(lowSampleResult.count).toBe(6);

      // Generate 35 mock trades
      const thirtyFiveTrades = Array.from({ length: 35 }, (_, i) => ({
        id: i + 1,
        pnl: i % 3 === 0 ? -50 : 120,
      }));
      const fullResult = calculateSharpeRatio(thirtyFiveTrades, 0.02, 30);
      expect(fullResult.isSampleBuilding).toBe(false);
      expect(typeof fullResult.sharpeRatio).toBe('number');
      expect(fullResult.tier).toBeDefined();
    });
  });

  describe('calculateTimeOfDayMatrix', () => {
    it('populates 24h x 5 weekday matrix', () => {
      const result = calculateTimeOfDayMatrix(sampleTrades);
      expect(result.days.length).toBe(5);
      expect(result.slotsList.length).toBe(120); // 24 * 5
    });
  });

  describe('calculatePsychologyStats', () => {
    it('correlates emotional states with profit and loss', () => {
      const result = calculatePsychologyStats(sampleTrades);
      expect(result.emotionList.length).toBeGreaterThanOrEqual(2);
      expect(result.plannedStats).toBeDefined();
      expect(result.plannedStats.totalPnl).toBeGreaterThan(0);
      expect(result.totalEmotionalPnl).toBeLessThan(0); // FOMO + Revenge were negative
    });
  });
});
