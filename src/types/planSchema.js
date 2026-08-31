/**
 * Canonical Target Plan Type Definition
 * 
 * @typedef {Object} TargetPlan
 * @property {string} id - Unique plan ID (e.g. 'plan_1700000000000')
 * @property {string} name - Display title for the plan (e.g. 'Small Account Doubler ($50 ➔ $100)')
 * @property {string} accountId - Linked account ID or 'all' for aggregate
 * @property {number} startingBalance - Initial planned starting capital ($)
 * @property {number} targetBalance - Goal target capital ($)
 * @property {number} riskPerTradePct - Max risk percentage per trade (e.g. 2.0%)
 * @property {number} targetRR - Desired minimum Risk-to-Reward ratio (e.g. 2.0 for 1:2)
 * @property {number} maxDailyLossPct - Daily maximum loss circuit breaker percentage (e.g. 4.0%)
 * @property {number} drawdownFloor - Absolute capital floor / hard preservation stop ($)
 * @property {number} maxOpenTrades - Max concurrent open positions allowed (default 1 for small accounts)
 * @property {number} milestoneStages - Number of intermediate milestones (default 4)
 * @property {Array<{id: string, text: string, enabled: boolean}>} rules - Discipline checklist
 * @property {'active'|'achieved'|'breached'|'paused'} status - Current plan state
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

export const DEFAULT_PLAN_RULES = [
  { id: 'rule_risk', text: 'Never exceed the planned risk % on any single trade', enabled: true },
  { id: 'rule_daily_stop', text: 'Stop trading immediately if daily loss limit is hit', enabled: true },
  { id: 'rule_rr', text: 'Take setups with at least 1:2 Risk-to-Reward ratio', enabled: true },
  { id: 'rule_no_revenge', text: 'Do not increase lot size or revenge trade after a loss', enabled: true },
  { id: 'rule_one_pos', text: 'Maintain max 1 open position at a time on micro accounts', enabled: true },
];

export const PLAN_PRESETS = [
  {
    id: 'preset_micro_doubler',
    name: 'Micro Account Doubler ($50 ➔ $100)',
    description: 'Disciplined compounding roadmap to double a micro account with strict 2% risk control.',
    startingBalance: 50,
    targetBalance: 100,
    riskPerTradePct: 2.0,
    targetRR: 2.0,
    maxDailyLossPct: 4.0,
    drawdownFloor: 40,
    maxOpenTrades: 1,
    milestoneStages: 4,
  },
  {
    id: 'preset_small_ladder',
    name: 'Small Account Growth ($100 ➔ $250)',
    description: 'Systematic scaling plan targeting 2.5x growth with 2% risk and 1:2.5 minimum R:R.',
    startingBalance: 100,
    targetBalance: 250,
    riskPerTradePct: 2.0,
    targetRR: 2.5,
    maxDailyLossPct: 4.0,
    drawdownFloor: 80,
    maxOpenTrades: 1,
    milestoneStages: 5,
  },
  {
    id: 'preset_prop_phase1',
    name: 'Prop Firm Challenge Phase 1 ($10,000 ➔ $10,800)',
    description: 'Standard 8% profit target with strict 3% daily drawdown and 10% maximum overall drawdown preservation.',
    startingBalance: 10000,
    targetBalance: 10800,
    riskPerTradePct: 0.75,
    targetRR: 2.0,
    maxDailyLossPct: 3.0,
    drawdownFloor: 9000,
    maxOpenTrades: 2,
    milestoneStages: 4,
  },
  {
    id: 'preset_capital_50',
    name: 'Conservative 50% Capital Expansion ($500 ➔ $750)',
    description: 'Steady swing & trend-following roadmap targeting 50% gain with conservative 1% risk per setup.',
    startingBalance: 500,
    targetBalance: 750,
    riskPerTradePct: 1.0,
    targetRR: 2.0,
    maxDailyLossPct: 3.0,
    drawdownFloor: 450,
    maxOpenTrades: 2,
    milestoneStages: 4,
  },
];

/**
 * Creates a normalized TargetPlan object ensuring all canonical fields are present.
 * @param {Partial<TargetPlan>} data 
 * @returns {TargetPlan}
 */
export function createTargetPlan(data = {}) {
  const now = new Date().toISOString();
  const starting = Math.max(1, parseFloat(data.startingBalance) || 50);
  const target = Math.max(starting + 1, parseFloat(data.targetBalance) || 100);
  const defaultFloor = Math.round(starting * 0.8 * 100) / 100; // 20% max DD floor default

  return {
    id: data.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name || 'Account Growth Target ($50 ➔ $100)',
    accountId: data.accountId || 'all',
    startingBalance: starting,
    targetBalance: target,
    riskPerTradePct: Math.max(0.1, parseFloat(data.riskPerTradePct) || 2.0),
    targetRR: Math.max(1.0, parseFloat(data.targetRR) || 2.0),
    maxDailyLossPct: Math.max(0.5, parseFloat(data.maxDailyLossPct) || 4.0),
    drawdownFloor: typeof data.drawdownFloor === 'number' ? data.drawdownFloor : (parseFloat(data.drawdownFloor) || defaultFloor),
    maxOpenTrades: Math.max(1, parseInt(data.maxOpenTrades, 10) || 1),
    milestoneStages: Math.max(2, Math.min(10, parseInt(data.milestoneStages, 10) || 4)),
    rules: Array.isArray(data.rules) && data.rules.length > 0 ? data.rules : DEFAULT_PLAN_RULES,
    status: data.status || 'active',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}
