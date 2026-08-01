/**
 * Pure Mathematical Calculations for XAU/USD Trading Metrics
 * 
 * Standard XAU/USD Contract Specs:
 * 1 standard lot = 100 oz of gold
 * $1.00 price move = $100 per 1.00 lot
 * $0.10 price move (1 pip / 10 points) = $10 per 1.00 lot
 */

/**
 * Calculates net profit/loss for a trade in USD
 * @param {'Buy'|'Sell'} side 
 * @param {number} entryPrice 
 * @param {number} exitPrice 
 * @param {number} lotSize 
 * @param {number} [contractSize=100] 
 * @returns {number} PnL in USD (rounded to 2 decimals)
 */
export function calculatePnL(side, entryPrice, exitPrice, lotSize, contractSize = 100) {
  if (!entryPrice || !exitPrice || !lotSize) return 0;
  const diff = side === 'Buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pnl = diff * lotSize * contractSize;
  return Math.round(pnl * 100) / 100;
}

/**
 * Calculates Risk-Reward Ratio (RR)
 * @param {'Buy'|'Sell'} side 
 * @param {number} entryPrice 
 * @param {number} stopLoss 
 * @param {number} takeProfit 
 * @returns {number} RR ratio (e.g. 2.1 for 1:2.1)
 */
export function calculateRR(side, entryPrice, stopLoss, takeProfit) {
  if (!entryPrice || !stopLoss || !takeProfit) return 0;
  
  const riskDist = Math.abs(entryPrice - stopLoss);
  if (riskDist === 0) return 0;

  const rewardDist = side === 'Buy' ? takeProfit - entryPrice : entryPrice - takeProfit;
  const rr = rewardDist / riskDist;
  return Math.round(rr * 100) / 100;
}

/**
 * Calculates recommended lot size for XAU/USD given account parameters
 * @param {number} accountBalance - Total account balance ($)
 * @param {number} riskPercentage - Risk percentage (e.g. 1.0 for 1%)
 * @param {number} entryPrice - Planned entry price
 * @param {number} stopLossPrice - Planned stop loss price
 * @param {number} [contractSize=100] - Ounces per lot (default 100)
 * @returns {{ riskAmount: number, lotSize: number, stopDistance: number }}
 */
export function calculateLotSize(accountBalance, riskPercentage, entryPrice, stopLossPrice, contractSize = 100) {
  const balance = Math.max(0, parseFloat(accountBalance) || 0);
  const riskPct = Math.max(0, parseFloat(riskPercentage) || 0);
  const entry = parseFloat(entryPrice) || 0;
  const stop = parseFloat(stopLossPrice) || 0;

  const riskAmount = (balance * riskPct) / 100;
  const stopDistance = Math.abs(entry - stop);

  if (stopDistance === 0 || riskAmount === 0 || contractSize <= 0) {
    return { riskAmount: Math.round(riskAmount * 100) / 100, lotSize: 0, stopDistance: 0 };
  }

  // Value per lot for stop distance = stopDistance * contractSize
  const rawLotSize = riskAmount / (stopDistance * contractSize);
  // Round lot size to 2 decimal places (standard broker lot precision 0.01)
  const lotSize = Math.round(rawLotSize * 100) / 100;

  return {
    riskAmount: Math.round(riskAmount * 100) / 100,
    lotSize: Math.max(0.01, lotSize),
    stopDistance: Math.round(stopDistance * 100) / 100,
  };
}

/**
 * Calculates aggregate performance statistics from an array of trades
 * @param {import('../types/tradeSchema').Trade[]} trades 
 * @param {number} [initialBalance=10000]
 * @returns {Object} Aggregate metrics
 */
export function calculatePerformanceStats(trades = [], initialBalance = 10000) {
  if (!trades.length) {
    return {
      totalPnl: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      profitFactor: 0,
      avgRR: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdownPct: 0,
      maxDrawdownDollar: 0,
      currentBalance: initialBalance,
      expectancy: 0,
    };
  }

  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalRR = 0;

  // Track equity curve for max drawdown calculation
  let currentEquity = initialBalance;
  let peakEquity = initialBalance;
  let maxDrawdownDollar = 0;
  let maxDrawdownPct = 0;

  // Sort trades chronologically
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (const t of sorted) {
    const pnl = t.pnl || 0;
    totalPnl += pnl;
    totalRR += t.rr || 0;
    currentEquity += pnl;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    } else {
      const ddDollar = peakEquity - currentEquity;
      const ddPct = (ddDollar / peakEquity) * 100;
      if (ddDollar > maxDrawdownDollar) maxDrawdownDollar = ddDollar;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
    } else {
      breakevens++;
    }
  }

  const totalTrades = trades.length;
  const winRate = Math.round((wins / totalTrades) * 100);
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0;
  const avgRR = Math.round((totalRR / totalTrades) * 100) / 100;
  const avgWin = wins > 0 ? Math.round((grossProfit / wins) * 100) / 100 : 0;
  const avgLoss = losses > 0 ? Math.round((grossLoss / losses) * 100) / 100 : 0;
  const expectancy = totalTrades > 0 ? Math.round((totalPnl / totalTrades) * 100) / 100 : 0;

  return {
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    profitFactor,
    avgRR,
    avgWin,
    avgLoss,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    maxDrawdownDollar: Math.round(maxDrawdownDollar * 100) / 100,
    currentBalance: Math.round((initialBalance + totalPnl) * 100) / 100,
    expectancy,
  };
}
