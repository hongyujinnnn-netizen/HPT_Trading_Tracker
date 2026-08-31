import { describe, it, expect } from 'vitest';
import {
  calculatePlanProgress,
  generateMilestones,
  calculateNextTradeSize,
  simulatePlanProjection,
  calculateDailyRiskStatus,
} from '../planCalculations';
import { createTargetPlan } from '../../types/planSchema';

describe('Target Plan Calculations', () => {
  const samplePlan = createTargetPlan({
    startingBalance: 50,
    targetBalance: 100,
    riskPerTradePct: 2.0,
    targetRR: 2.0,
    maxDailyLossPct: 4.0,
    drawdownFloor: 40,
    milestoneStages: 4,
  });

  describe('calculatePlanProgress', () => {
    it('calculates 0% progress at starting balance', () => {
      const progress = calculatePlanProgress(samplePlan, 50);
      expect(progress.progressPct).toBe(0);
      expect(progress.currentGain).toBe(0);
      expect(progress.totalTargetGain).toBe(50);
      expect(progress.remainingGain).toBe(50);
      expect(progress.status).toBe('on_track');
      expect(progress.riskAmount).toBe(1.0); // 2% of $50
      expect(progress.dailyLossLimit).toBe(2.0); // 4% of $50
    });

    it('calculates 50% progress halfway to target', () => {
      const progress = calculatePlanProgress(samplePlan, 75);
      expect(progress.progressPct).toBe(50);
      expect(progress.currentGain).toBe(25);
      expect(progress.remainingGain).toBe(25);
      expect(progress.riskAmount).toBe(1.5); // 2% of $75
      expect(progress.status).toBe('on_track');
    });

    it('detects goal achieved when balance >= target', () => {
      const progress = calculatePlanProgress(samplePlan, 105);
      expect(progress.progressPct).toBe(100);
      expect(progress.remainingGain).toBe(0);
      expect(progress.status).toBe('achieved');
    });

    it('detects floor breach when balance falls below floor', () => {
      const progress = calculatePlanProgress(samplePlan, 38);
      expect(progress.status).toBe('floor_breached');
      expect(progress.drawdownCushion).toBe(0);
    });

    it('detects drawdown when balance is between floor and start', () => {
      const progress = calculatePlanProgress(samplePlan, 45);
      expect(progress.status).toBe('drawdown');
      expect(progress.drawdownCushion).toBe(5);
    });
  });

  describe('generateMilestones', () => {
    it('generates 4 equal stages from $50 to $100', () => {
      const stages = generateMilestones(samplePlan, 65, 100);
      expect(stages.length).toBe(4);
      expect(stages[0].stageStart).toBe(50);
      expect(stages[0].stageTarget).toBe(62.5);
      expect(stages[0].isCompleted).toBe(true); // $65 >= $62.5

      expect(stages[1].stageStart).toBe(62.5);
      expect(stages[1].stageTarget).toBe(75);
      expect(stages[1].isActive).toBe(true); // $65 is between 62.5 and 75

      expect(stages[2].stageStart).toBe(75);
      expect(stages[2].isLocked).toBe(true);
    });
  });

  describe('calculateNextTradeSize', () => {
    it('calculates correct risk dollar and lot size for gold', () => {
      const sizing = calculateNextTradeSize(samplePlan, 100, 2.0, 100);
      // $100 balance, 2% risk = $2.00
      // Stop loss $2.00 (20 pips), 100 oz contract => raw lot = $2 / ($2 * 100) = 0.01 lot
      expect(sizing.riskDollar).toBe(2.0);
      expect(sizing.lotSize).toBe(0.01);
      expect(sizing.targetDollar).toBe(4.0); // 1:2 RR
    });

    it('warns when account balance is small for gold 0.01 standard lot', () => {
      const sizing = calculateNextTradeSize(samplePlan, 50, 3.0, 100);
      // 0.01 lot on $3.00 stop = $3.00 loss, but 2% of $50 is only $1.00
      expect(sizing.isOverleveragedForSmallBalance).toBe(true);
    });
  });

  describe('simulatePlanProjection', () => {
    it('generates trajectory points starting from start balance', () => {
      const points = simulatePlanProjection(samplePlan, [], 10, 50);
      expect(points.length).toBeGreaterThan(10);
      expect(points[0].plannedEquity).toBe(50);
      expect(points[0].targetLine).toBe(100);
    });
  });

  describe('calculateDailyRiskStatus', () => {
    it('accurately checks today loss against daily circuit breaker', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const trades = [
        { date: todayStr, pnl: -1.0 },
        { date: todayStr, pnl: -1.5 },
      ];
      // Total loss = -$2.50, limit is 4% of $50 = $2.00
      const daily = calculateDailyRiskStatus(trades, samplePlan);
      expect(daily.todayPnl).toBe(-2.5);
      expect(daily.maxAllowedDailyLoss).toBe(2.0);
      expect(daily.isDailyLimitBreached).toBe(true);
    });
  });
});
