/**
 * Plan Target Calculations & Risk Engine
 * Mathematical utilities for tracking progress, computing risk guardrails,
 * calculating compounding trajectories, and sizing micro-lots.
 */

/**
 * Calculates current progress metrics of a target plan against current account balance
 * @param {import('../types/planSchema').TargetPlan} plan 
 * @param {number} currentBalance 
 * @returns {Object} Progress metrics
 */
export function calculatePlanProgress(plan, currentBalance = 0) {
  const start = Math.max(1, parseFloat(plan?.startingBalance) || 50);
  const target = Math.max(start + 1, parseFloat(plan?.targetBalance) || 100);
  const floor = typeof plan?.drawdownFloor === 'number' ? plan.drawdownFloor : start * 0.8;
  const balance = typeof currentBalance === 'number' ? currentBalance : parseFloat(currentBalance) || 0;

  const totalTargetGain = Math.round((target - start) * 100) / 100;
  const currentGain = Math.round((balance - start) * 100) / 100;
  const remainingGain = Math.max(0, Math.round((target - balance) * 100) / 100);

  // Progress percentage (0% to 100%+)
  const progressRatio = totalTargetGain > 0 ? currentGain / totalTargetGain : 0;
  const progressPct = Math.min(100, Math.max(0, Math.round(progressRatio * 1000) / 10));

  const targetRoiPct = Math.round(((target - start) / start) * 1000) / 10;
  const currentRoiPct = Math.round(((balance - start) / start) * 1000) / 10;

  // Drawdown cushion before hitting safety floor
  const drawdownCushion = Math.max(0, Math.round((balance - floor) * 100) / 100);
  const drawdownCushionPct = balance > 0
    ? Math.round(((balance - floor) / balance) * 1000) / 10
    : 0;

  // Status determination
  let status = 'on_track';
  if (balance >= target) {
    status = 'achieved';
  } else if (balance <= floor) {
    status = 'floor_breached';
  } else if (balance < start) {
    status = 'drawdown';
  } else {
    status = 'on_track';
  }

  // Risk dollar budget per trade based on CURRENT balance
  const riskAmount = Math.max(0, Math.round((balance * (plan?.riskPerTradePct || 2.0)) / 100 * 100) / 100);

  // Daily max loss dollar threshold
  const dailyLossLimit = Math.max(0, Math.round((start * (plan?.maxDailyLossPct || 4.0)) / 100 * 100) / 100);

  return {
    start,
    target,
    floor,
    currentBalance: balance,
    totalTargetGain,
    currentGain,
    remainingGain,
    progressPct,
    targetRoiPct,
    currentRoiPct,
    drawdownCushion,
    drawdownCushionPct,
    status,
    riskAmount,
    dailyLossLimit,
  };
}

/**
 * Generates milestone ladder stages from start balance to target balance
 * @param {import('../types/planSchema').TargetPlan} plan 
 * @param {number} currentBalance 
 * @param {number} [contractSize=100]
 * @returns {Array<Object>} List of milestone stages
 */
export function generateMilestones(plan, currentBalance = 0, contractSize = 100) {
  const start = Math.max(1, parseFloat(plan?.startingBalance) || 50);
  const target = Math.max(start + 1, parseFloat(plan?.targetBalance) || 100);
  const stagesCount = Math.max(2, Math.min(10, parseInt(plan?.milestoneStages, 10) || 4));
  const totalGain = target - start;
  const stageStep = totalGain / stagesCount;
  const balance = typeof currentBalance === 'number' ? currentBalance : parseFloat(currentBalance) || 0;

  const milestones = [];

  for (let i = 1; i <= stagesCount; i++) {
    const stageStart = Math.round((start + stageStep * (i - 1)) * 100) / 100;
    const stageTarget = Math.round((start + stageStep * i) * 100) / 100;
    const stageGain = Math.round((stageTarget - stageStart) * 100) / 100;
    const stagePct = Math.round((i / stagesCount) * 100);

    const isCompleted = balance >= stageTarget;
    const isActive = !isCompleted && balance >= stageStart;
    const isLocked = balance < stageStart;

    // Recommended lot size for typical 25-pip ($2.50) gold stop loss
    const avgStopDistance = 2.5; // $2.50 on Gold
    const stageRiskAmount = (stageStart * (plan?.riskPerTradePct || 2.0)) / 100;
    const rawLot = stageRiskAmount / (avgStopDistance * contractSize);
    const recommendedLot = Math.max(0.01, Math.round(rawLot * 100) / 100);

    milestones.push({
      stage: i,
      title: i === stagesCount ? 'Goal Finish Line 🎯' : `Level ${i}`,
      stageStart,
      stageTarget,
      stageGain,
      stagePct,
      isCompleted,
      isActive,
      isLocked,
      recommendedLot,
      stageRiskAmount: Math.round(stageRiskAmount * 100) / 100,
    });
  }

  return milestones;
}

/**
 * Calculates exact position sizing for the immediate next trade right now
 * @param {import('../types/planSchema').TargetPlan} plan 
 * @param {number} currentBalance 
 * @param {number} [stopLossPoints=2.0] - Stop loss distance in price points (e.g. $2.00 / 20 pips)
 * @param {number} [contractSize=100]
 * @returns {Object} Sizing calculation and warnings
 */
export function calculateNextTradeSize(plan, currentBalance = 0, stopLossPoints = 2.0, contractSize = 100) {
  const balance = Math.max(0, typeof currentBalance === 'number' ? currentBalance : parseFloat(currentBalance) || 0);
  const riskPct = Math.max(0.1, parseFloat(plan?.riskPerTradePct) || 2.0);
  const targetRR = Math.max(1.0, parseFloat(plan?.targetRR) || 2.0);
  const stopDist = Math.max(0.1, parseFloat(stopLossPoints) || 2.0);

  const riskDollar = Math.round((balance * riskPct) / 100 * 100) / 100;
  const rawLot = riskDollar / (stopDist * contractSize);
  const lotSize = Math.max(0.01, Math.round(rawLot * 100) / 100);

  // Exact dollar loss if minimum 0.01 lot hits stop
  const actualRiskAtMinLot = Math.round(0.01 * stopDist * contractSize * 100) / 100;
  const isOverleveragedForSmallBalance = actualRiskAtMinLot > riskDollar * 1.35 && balance < 100;

  const targetDollar = Math.round(riskDollar * targetRR * 100) / 100;
  const targetDistancePoints = Math.round(stopDist * targetRR * 100) / 100;

  return {
    balance,
    riskPct,
    riskDollar,
    stopDist,
    lotSize,
    targetRR,
    targetDollar,
    targetDistancePoints,
    actualRiskAtMinLot,
    isOverleveragedForSmallBalance,
  };
}

/**
 * Simulates compounding growth trajectory vs actual trade equity
 * @param {import('../types/planSchema').TargetPlan} plan 
 * @param {Array<import('../types/tradeSchema').Trade>} trades 
 * @param {number} [projectionTrades=20]
 * @param {number} [winRate=50]
 * @returns {Array<Object>} Projection points for Recharts
 */
export function simulatePlanProjection(plan, trades = [], projectionTrades = 20, winRate = 50) {
  const start = Math.max(1, parseFloat(plan?.startingBalance) || 50);
  const target = Math.max(start + 1, parseFloat(plan?.targetBalance) || 100);
  const riskPct = Math.max(0.1, parseFloat(plan?.riskPerTradePct) || 2.0) / 100;
  const rr = Math.max(1.0, parseFloat(plan?.targetRR) || 2.0);
  const wr = Math.max(10, Math.min(90, parseFloat(winRate) || 50)) / 100;

  // Expected Value per trade in R units
  const evR = wr * rr - (1 - wr) * 1.0;

  const points = [];
  let plannedBalance = start;

  // Historical actual balance curve
  let actualBalance = start;
  const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const totalPoints = Math.max(projectionTrades, sortedTrades.length + 5);

  for (let i = 0; i <= totalPoints; i++) {
    if (i === 0) {
      points.push({
        tradeIndex: 0,
        plannedEquity: start,
        actualEquity: start,
        targetLine: target,
      });
      continue;
    }

    // Planned compounding formula: Bal * (1 + evR * riskPct)
    if (plannedBalance < target * 1.1) {
      plannedBalance = Math.round(plannedBalance * (1 + evR * riskPct) * 100) / 100;
    }

    let actEquity = null;
    if (i <= sortedTrades.length) {
      actualBalance += sortedTrades[i - 1].pnl || 0;
      actEquity = Math.round(actualBalance * 100) / 100;
    }

    points.push({
      tradeIndex: i,
      plannedEquity: Math.min(target * 1.25, plannedBalance),
      actualEquity: actEquity,
      targetLine: target,
    });
  }

  return points;
}

/**
 * Evaluates today's realized PnL against the plan's daily loss limit
 * @param {Array<import('../types/tradeSchema').Trade>} trades 
 * @param {import('../types/planSchema').TargetPlan} plan 
 * @returns {Object} Daily loss evaluation
 */
export function calculateDailyRiskStatus(trades = [], plan) {
  const todayStr = new Date().toISOString().split('T')[0];
  const start = Math.max(1, parseFloat(plan?.startingBalance) || 50);
  const dailyLimitPct = Math.max(0.5, parseFloat(plan?.maxDailyLossPct) || 4.0);
  const maxAllowedDailyLoss = Math.round((start * dailyLimitPct) / 100 * 100) / 100;

  const todayTrades = trades.filter((t) => {
    const tradeDate = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '');
    return tradeDate === todayStr;
  });

  const todayPnl = Math.round(todayTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) * 100) / 100;
  const isDailyLimitBreached = todayPnl < 0 && Math.abs(todayPnl) >= maxAllowedDailyLoss;
  const remainingDailyRisk = Math.max(0, Math.round((maxAllowedDailyLoss + (todayPnl < 0 ? todayPnl : 0)) * 100) / 100);

  return {
    todayTradeCount: todayTrades.length,
    todayPnl,
    maxAllowedDailyLoss,
    isDailyLimitBreached,
    remainingDailyRisk,
  };
}
