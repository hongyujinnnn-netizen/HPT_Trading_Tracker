/**
 * Quantitative Edge Analytics & Behavioral Audit Engine
 * 
 * Provides mathematical modeling for:
 * 1. Rolling Win Rate (real-time edge degradation detection)
 * 2. R-Multiple Distribution & Skewness Analysis
 * 3. Drawdown Underwater Curve & Duration Tracking
 * 4. Rigorous Dollar Expectancy & Position Sizing Linking
 * 5. Time-of-Day Heat Map Matrix (Hour x Weekday)
 * 6. Sharpe Ratio with N >= 30 Sample Guardrail
 * 7. Psychology & Emotion Correlation with P&L
 */

/**
 * Calculates Rolling Win Rate across an array of trades sorted chronologically.
 * 
 * @param {Array} trades 
 * @param {number} windowSize - Default 20 trades
 * @param {number} baseline - Target win rate baseline percentage (default 50%)
 * @returns {Object} { points, currentRollingWinRate, belowBaselineStreak, hasAlert, baseline }
 */
export function calculateRollingWinRate(trades = [], windowSize = 20, baseline = 50) {
  if (!trades || trades.length === 0) {
    return {
      points: [],
      currentRollingWinRate: 0,
      belowBaselineStreak: 0,
      hasAlert: false,
      baseline,
      windowSize,
    };
  }

  // Sort trades chronologically
  const sorted = [...trades]
    .filter((t) => t.pnl !== undefined && t.status !== 'open')
    .sort((a, b) => new Date(a.date || a.timestamp || 0) - new Date(b.date || b.timestamp || 0));

  if (sorted.length === 0) {
    return {
      points: [],
      currentRollingWinRate: 0,
      belowBaselineStreak: 0,
      hasAlert: false,
      baseline,
      windowSize,
    };
  }

  const effectiveWindow = Math.min(windowSize, Math.max(5, Math.floor(sorted.length / 2)) || 5);
  const points = [];
  let belowBaselineStreak = 0;

  for (let i = 0; i < sorted.length; i++) {
    const windowStart = Math.max(0, i - effectiveWindow + 1);
    const currentWindow = sorted.slice(windowStart, i + 1);
    const wins = currentWindow.filter((t) => (t.pnl || 0) > 0).length;
    const rollingWinRate = Math.round((wins / currentWindow.length) * 100);

    if (rollingWinRate < baseline) {
      belowBaselineStreak++;
    } else {
      belowBaselineStreak = 0;
    }

    const trade = sorted[i];
    const dateStr = trade.date || (trade.timestamp ? trade.timestamp.split('T')[0] : `T#${i + 1}`);

    points.push({
      tradeNumber: i + 1,
      tradeId: trade.id,
      date: dateStr,
      pnl: trade.pnl || 0,
      rollingWinRate,
      baseline,
      sampleSize: currentWindow.length,
      belowBaseline: rollingWinRate < baseline,
      alert: belowBaselineStreak >= 2,
    });
  }

  const latestPoint = points[points.length - 1];
  const currentRollingWinRate = latestPoint ? latestPoint.rollingWinRate : 0;
  // Alert if the latest readings stayed below baseline for 2 or more readings
  const hasAlert = belowBaselineStreak >= 2;

  return {
    points,
    currentRollingWinRate,
    belowBaselineStreak,
    hasAlert,
    baseline,
    windowSize: effectiveWindow,
  };
}

/**
 * Calculates R-Multiple Distribution and Skewness.
 * $R = \text{PnL} / \text{Risk}$.
 * If risk is not specified on trade, estimates based on SL distance or 1R standard.
 * 
 * @param {Array} trades 
 * @param {number} defaultRisk - Default risk in $ if trade has no sl/risk amount
 * @returns {Object} { buckets, skewness, skewnessType, avgWinR, avgLossR, medianR }
 */
export function calculateRMultipleDistribution(trades = [], defaultRisk = 100) {
  const closedTrades = [...trades].filter((t) => t.pnl !== undefined && t.status !== 'open');
  if (closedTrades.length === 0) {
    return {
      buckets: [],
      skewness: 0,
      skewnessType: 'Insufficient Data',
      avgWinR: 0,
      avgLossR: 0,
      tradesWithR: [],
    };
  }

  // Calculate R per trade
  const tradesWithR = closedTrades.map((t) => {
    let rValue = 0;
    const pnl = parseFloat(t.pnl) || 0;

    // Check if trade has explicit risk amount or calculated from entry and sl
    if (t.riskAmount && t.riskAmount > 0) {
      rValue = pnl / t.riskAmount;
    } else if (t.entryPrice && t.stopLoss && t.lotSize) {
      const dist = Math.abs(parseFloat(t.entryPrice) - parseFloat(t.stopLoss));
      const contractSize = t.contractSize || 100;
      const riskDollar = dist * parseFloat(t.lotSize) * contractSize;
      rValue = riskDollar > 0 ? pnl / riskDollar : (pnl > 0 ? 1 : pnl < 0 ? -1 : 0);
    } else if (t.rr && pnl > 0) {
      rValue = parseFloat(t.rr) || 1;
    } else {
      rValue = pnl / defaultRisk;
    }

    // Clamp extreme outliers to [-5, 10] for clean histogram display
    rValue = Math.max(-5, Math.min(10, Math.round(rValue * 10) / 10));
    return { ...t, rMultiple: rValue };
  });

  // Buckets definition
  const bucketDefs = [
    { label: '< -2R', min: -Infinity, max: -2.01, isLoss: true },
    { label: '-2R to -1.5R', min: -2.0, max: -1.51, isLoss: true },
    { label: '-1.5R to -1R', min: -1.5, max: -1.01, isLoss: true },
    { label: '-1R to -0.5R', min: -1.0, max: -0.51, isLoss: true },
    { label: '-0.5R to 0R', min: -0.5, max: -0.01, isLoss: true },
    { label: '0R (BE)', min: 0, max: 0.1, isBE: true },
    { label: '0.1R to 1R', min: 0.11, max: 1.0, isWin: true },
    { label: '1R to 2R', min: 1.01, max: 2.0, isWin: true },
    { label: '2R to 3R', min: 2.01, max: 3.0, isWin: true },
    { label: '3R to 4R', min: 3.01, max: 4.0, isWin: true },
    { label: '> +4R', min: 4.01, max: Infinity, isWin: true },
  ];

  const buckets = bucketDefs.map((b) => {
    const matching = tradesWithR.filter(
      (t) => t.rMultiple >= b.min && t.rMultiple <= b.max
    );
    return {
      range: b.label,
      count: matching.length,
      isLoss: b.isLoss,
      isBE: b.isBE,
      isWin: b.isWin,
      fill: b.isLoss ? '#C1502E' : b.isBE ? '#8B8D91' : '#3FA88C',
    };
  });

  // Calculate R statistics
  const rValues = tradesWithR.map((t) => t.rMultiple);
  const winRs = rValues.filter((r) => r > 0.1);
  const lossRs = rValues.filter((r) => r < 0);

  const avgWinR = winRs.length > 0 ? Math.round((winRs.reduce((s, r) => s + r, 0) / winRs.length) * 100) / 100 : 0;
  const avgLossR = lossRs.length > 0 ? Math.round((lossRs.reduce((s, r) => s + r, 0) / lossRs.length) * 100) / 100 : 0;

  // Pearson's skewness coefficient approximation: 3 * (Mean - Median) / StdDev
  const meanR = rValues.reduce((s, r) => s + r, 0) / rValues.length;
  const sortedR = [...rValues].sort((a, b) => a - b);
  const medianR = sortedR[Math.floor(sortedR.length / 2)] || 0;
  const variance = rValues.reduce((s, r) => s + Math.pow(r - meanR, 2), 0) / rValues.length;
  const stdDev = Math.sqrt(variance) || 1;
  const skewness = Math.round(((3 * (meanR - medianR)) / stdDev) * 100) / 100;

  let skewnessType = 'Symmetric (Balanced)';
  let skewnessDesc = 'Distribution is evenly balanced between winners and losers.';
  if (skewness > 0.3) {
    skewnessType = 'Right-Skewed (Healthy Edge)';
    skewnessDesc = 'Healthy trend-following distribution. You let winners run into fat right-tail profits!';
  } else if (skewness < -0.3) {
    skewnessType = 'Left-Skewed (Management Leak)';
    skewnessDesc = 'Cutting winners too early while absorbing full stop losses. Focus on trade management & targets.';
  }

  return {
    buckets,
    skewness,
    skewnessType,
    skewnessDesc,
    avgWinR,
    avgLossR,
    medianR,
    tradesWithR,
  };
}

/**
 * Calculates Drawdown Underwater Equity Curve & Duration Tracking.
 * 
 * @param {Array} trades 
 * @param {number} initialBalance 
 * @param {number} circuitBreakerPct - Default 10%
 * @returns {Object} Underwater curve points, episodes, maxDrawdown, circuitBreakerHit
 */
export function calculateUnderwaterDrawdown(trades = [], initialBalance = 10000, circuitBreakerPct = 10) {
  const sorted = [...trades]
    .filter((t) => t.pnl !== undefined && t.status !== 'open')
    .sort((a, b) => new Date(a.date || a.timestamp || 0) - new Date(b.date || b.timestamp || 0));

  if (sorted.length === 0) {
    return {
      points: [
        { date: 'Start', balance: initialBalance, peak: initialBalance, drawdownPct: 0, drawdownDollar: 0 },
      ],
      maxDrawdownPct: 0,
      maxDrawdownDollar: 0,
      currentDrawdownPct: 0,
      circuitBreakerHit: false,
      episodes: [],
    };
  }

  let balance = initialBalance;
  let peak = initialBalance;
  let maxDrawdownDollar = 0;
  let maxDrawdownPct = 0;

  const points = [];
  const episodes = [];
  let currentEpisode = null;

  sorted.forEach((t, index) => {
    const pnl = parseFloat(t.pnl) || 0;
    balance += pnl;
    const dateStr = t.date || (t.timestamp ? t.timestamp.split('T')[0] : `T#${index + 1}`);

    if (balance > peak) {
      peak = balance;
      // If we were in an episode, close it (recovery)
      if (currentEpisode) {
        currentEpisode.recoveryDate = dateStr;
        currentEpisode.recovered = true;
        currentEpisode.durationTrades = (index + 1) - currentEpisode.startIndex;
        episodes.push(currentEpisode);
        currentEpisode = null;
      }
    } else {
      const ddDollar = peak - balance;
      const ddPct = (ddDollar / peak) * 100;

      if (ddDollar > maxDrawdownDollar) maxDrawdownDollar = ddDollar;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

      // Start new drawdown episode if not already active
      if (!currentEpisode && ddPct > 0.5) {
        currentEpisode = {
          startDate: dateStr,
          startIndex: index,
          peakBalance: peak,
          troughBalance: balance,
          maxDepthPct: ddPct,
          maxDepthDollar: ddDollar,
          recovered: false,
        };
      } else if (currentEpisode) {
        if (ddPct > currentEpisode.maxDepthPct) {
          currentEpisode.maxDepthPct = ddPct;
          currentEpisode.maxDepthDollar = ddDollar;
          currentEpisode.troughBalance = balance;
        }
      }
    }

    const currentDdDollar = peak - balance;
    const currentDdPct = peak > 0 ? (currentDdDollar / peak) * 100 : 0;

    points.push({
      tradeIndex: index + 1,
      date: dateStr,
      balance: Math.round(balance * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      drawdownDollar: Math.round(currentDdDollar * 100) / 100,
      drawdownPct: -Math.round(currentDdPct * 100) / 100, // Negative for underwater representation
      circuitBreaker: -circuitBreakerPct,
    });
  });

  // If currently still in drawdown, record open episode
  if (currentEpisode) {
    currentEpisode.recoveryDate = 'Ongoing';
    currentEpisode.recovered = false;
    currentEpisode.durationTrades = sorted.length - currentEpisode.startIndex;
    episodes.push(currentEpisode);
  }

  const latestPoint = points[points.length - 1];
  const currentDrawdownPct = latestPoint ? Math.abs(latestPoint.drawdownPct) : 0;
  const circuitBreakerHit = currentDrawdownPct >= circuitBreakerPct;

  return {
    points,
    maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    maxDrawdownDollar: Math.round(maxDrawdownDollar * 100) / 100,
    currentDrawdownPct: Math.round(currentDrawdownPct * 100) / 100,
    circuitBreakerHit,
    circuitBreakerPct,
    episodes: episodes.sort((a, b) => b.maxDepthPct - a.maxDepthPct),
  };
}

/**
 * Calculates Dollar Expectancy per trade and links to position sizing advice.
 * Formula: (Win% * Avg Win $) - (Loss% * Avg Loss $)
 * 
 * @param {Array} trades 
 * @returns {Object} Expectancy stats and sizing recommendation
 */
export function calculateExpectancy(trades = []) {
  const closed = [...trades].filter((t) => t.pnl !== undefined && t.status !== 'open');
  if (closed.length === 0) {
    return {
      expectancy: 0,
      winRatePct: 0,
      lossRatePct: 0,
      avgWin: 0,
      avgLoss: 0,
      consecutiveNegativeTrades: 0,
      sizingAdvice: 'Neutral',
      sizingMultiplier: 1.0,
      sizingDesc: 'Awaiting trades to model expectancy.',
    };
  }

  const wins = closed.filter((t) => (t.pnl || 0) > 0);
  const losses = closed.filter((t) => (t.pnl || 0) < 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const total = closed.length;

  const winRatePct = (winCount / total) * 100;
  const lossRatePct = (lossCount / total) * 100;

  const sumWins = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const sumLosses = losses.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0);

  const avgWin = winCount > 0 ? sumWins / winCount : 0;
  const avgLoss = lossCount > 0 ? sumLosses / lossCount : 0;

  // Formula: (Win% * Avg Win) - (Loss% * Avg Loss)
  const expectancy = ((winRatePct / 100) * avgWin) - ((lossRatePct / 100) * avgLoss);

  // Check last N trades for negative expectancy / consecutive losses
  const sortedRecent = [...closed].sort((a, b) => new Date(b.date || b.timestamp || 0) - new Date(a.date || a.timestamp || 0));
  let consecutiveNegativeTrades = 0;
  for (const t of sortedRecent) {
    if ((t.pnl || 0) <= 0) {
      consecutiveNegativeTrades++;
    } else {
      break;
    }
  }

  let sizingAdvice = 'Standard';
  let sizingMultiplier = 1.0;
  let sizingDesc = 'Your mathematical expectancy is positive. Maintain disciplined 1-2% risk sizing.';

  if (expectancy <= 0 || consecutiveNegativeTrades >= 3) {
    sizingAdvice = 'Reduce Size / Pause';
    sizingMultiplier = 0.5;
    sizingDesc = 'Expectancy has turned negative or 3+ losses occurred. Cut lot size by 50% or pause to prevent drawdowns.';
  } else if (expectancy > 100 && winRatePct >= 60) {
    sizingAdvice = 'Optimal Edge';
    sizingMultiplier = 1.0;
    sizingDesc = 'High expectancy zone. Edge is statistically validated.';
  }

  return {
    expectancy: Math.round(expectancy * 100) / 100,
    winRatePct: Math.round(winRatePct * 10) / 10,
    lossRatePct: Math.round(lossRatePct * 10) / 10,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    consecutiveNegativeTrades,
    sizingAdvice,
    sizingMultiplier,
    sizingDesc,
  };
}

/**
 * Calculates Sharpe Ratio with N >= 30 Sample Guardrail.
 * Prevents misleading retail metrics by withholding noisy small-sample ratios.
 * 
 * @param {Array} trades 
 * @param {number} riskFreeRate - Annualized risk-free rate (default 2%)
 * @param {number} minTrades - Minimum trades guardrail (default 30)
 * @returns {Object} Sharpe ratio, guardrail status, tier benchmark
 */
export function calculateSharpeRatio(trades = [], riskFreeRate = 0.02, minTrades = 30) {
  const closed = [...trades].filter((t) => t.pnl !== undefined && t.status !== 'open');
  const count = closed.length;

  if (count < minTrades) {
    return {
      isSampleBuilding: true,
      count,
      minTrades,
      progressPct: Math.min(100, Math.round((count / minTrades) * 100)),
      sharpeRatio: null,
      tier: 'Sample Building',
      benchmark: 'Requires 30+ closed trades to filter retail noise and establish statistical validity.',
    };
  }

  // Calculate percentage returns based on initial balance or average trade return
  const returns = closed.map((t) => parseFloat(t.pnl) || 0);
  const meanReturn = returns.reduce((s, r) => s + r, 0) / count;
  const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (count - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return {
      isSampleBuilding: false,
      count,
      minTrades,
      sharpeRatio: 0,
      tier: 'Flat',
      benchmark: 'Zero variance in returns.',
    };
  }

  // Annualized assumption: ~250 trading days / 2 trades per day = ~500 trades per year
  const annualizedFactor = Math.sqrt(250);
  const rawSharpe = ((meanReturn - (riskFreeRate / 250)) / stdDev) * annualizedFactor;
  const sharpeRatio = Math.round(rawSharpe * 100) / 100;

  let tier = 'Marginal Edge';
  let benchmark = 'Sharpe < 1.0 indicates high return volatility relative to risk.';

  if (sharpeRatio >= 2.0) {
    tier = 'Institutional / Elite Edge';
    benchmark = 'Sharpe > 2.0 reflects world-class risk-adjusted performance with minimal volatility.';
  } else if (sharpeRatio >= 1.5) {
    tier = 'Strong Edge';
    benchmark = 'Sharpe > 1.5 represents a robust statistical edge for active traders.';
  } else if (sharpeRatio >= 1.0) {
    tier = 'Adequate';
    benchmark = 'Sharpe 1.0–1.5 demonstrates consistent edge with moderate variance.';
  }

  return {
    isSampleBuilding: false,
    count,
    minTrades,
    sharpeRatio,
    tier,
    benchmark,
  };
}

/**
 * Calculates Time-of-Day Heat Map Matrix (24 Hours x 5 Weekdays).
 * Enables identifying profitable vs loss-generating slots.
 * 
 * @param {Array} trades 
 * @returns {Object} Matrix cells, bestSlot, worstSlot, redSlots list
 */
export function calculateTimeOfDayMatrix(trades = []) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const matrix = {};

  // Initialize matrix: day -> hour -> { pnl, trades, wins }
  days.forEach((day) => {
    matrix[day] = {};
    for (let h = 0; h < 24; h++) {
      matrix[day][h] = { pnl: 0, trades: 0, wins: 0 };
    }
  });

  trades.forEach((t) => {
    if (!t.date && !t.timestamp) return;
    const dateObj = new Date(t.timestamp || t.date);
    if (isNaN(dateObj.getTime())) return;

    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = dateObj.getUTCHours(); // Standardized to UTC
    const pnl = parseFloat(t.pnl) || 0;

    if (matrix[dayName] && matrix[dayName][hour]) {
      matrix[dayName][hour].trades++;
      matrix[dayName][hour].pnl += pnl;
      if (pnl > 0) matrix[dayName][hour].wins++;
    }
  });

  const slotsList = [];
  days.forEach((day) => {
    for (let h = 0; h < 24; h++) {
      const slot = matrix[day][h];
      const winRate = slot.trades > 0 ? Math.round((slot.wins / slot.trades) * 100) : 0;
      slotsList.push({
        day,
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00 UTC`,
        pnl: Math.round(slot.pnl * 100) / 100,
        trades: slot.trades,
        winRate,
        isRed: slot.pnl < 0 && slot.trades >= 2,
        isGreen: slot.pnl > 0 && slot.trades >= 2,
      });
    }
  });

  const activeSlots = slotsList.filter((s) => s.trades > 0);
  const bestSlot = [...activeSlots].sort((a, b) => b.pnl - a.pnl)[0] || null;
  const worstSlot = [...activeSlots].sort((a, b) => a.pnl - b.pnl)[0] || null;
  const redSlots = slotsList.filter((s) => s.isRed);

  return {
    days,
    matrix,
    slotsList,
    bestSlot,
    worstSlot,
    redSlots,
  };
}

/**
 * Calculates Psychology & Emotional State correlation with P&L.
 * Spots behavioral leaks where emotional trades drain profits.
 * 
 * @param {Array} trades 
 * @returns {Object} Stats grouped by emotion and mistake tag
 */
export function calculatePsychologyStats(trades = []) {
  const emotionMap = {};

  trades.forEach((t) => {
    const emotion = t.emotion || 'Unspecified';
    const pnl = parseFloat(t.pnl) || 0;

    if (!emotionMap[emotion]) {
      emotionMap[emotion] = { emotion, count: 0, wins: 0, losses: 0, totalPnl: 0 };
    }

    emotionMap[emotion].count++;
    emotionMap[emotion].totalPnl += pnl;
    if (pnl > 0) emotionMap[emotion].wins++;
    if (pnl < 0) emotionMap[emotion].losses++;
  });

  const emotionList = Object.values(emotionMap).map((item) => ({
    ...item,
    totalPnl: Math.round(item.totalPnl * 100) / 100,
    winRate: item.count > 0 ? Math.round((item.wins / item.count) * 100) : 0,
    avgPnl: item.count > 0 ? Math.round((item.totalPnl / item.count) * 100) / 100 : 0,
  })).sort((a, b) => b.totalPnl - a.totalPnl);

  const plannedStats = emotionList.find((e) => e.emotion.toLowerCase().includes('plan')) || null;
  const emotionalStats = emotionList.filter((e) => !e.emotion.toLowerCase().includes('plan'));
  const totalEmotionalPnl = emotionalStats.reduce((sum, e) => sum + e.totalPnl, 0);

  return {
    emotionList,
    plannedStats,
    totalEmotionalPnl: Math.round(totalEmotionalPnl * 100) / 100,
    isDisciplinedDominant: plannedStats ? plannedStats.totalPnl > 0 : false,
  };
}
