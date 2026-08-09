/**
 * MT5 Deal Classifier & Position-Pairing Engine
 * 
 * Separates balance operations from trade deals, groups deal fills by Position ID,
 * and volume-weights prices for single-shot & partial close positions.
 */

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function weightedAvg(rows, valueKey, weightKey) {
  const totalWeight = sum(rows.map((r) => r[weightKey]));
  if (totalWeight === 0) return 0;
  const weightedSum = sum(rows.map((r) => r[valueKey] * r[weightKey]));
  return weightedSum / totalWeight;
}

/**
 * Classifies raw MT5 report rows into balance operations and trade deals.
 * @param {Array<Object>} rawRows 
 * @returns {{ balanceOps: Array<Object>, dealRows: Array<Object> }}
 */
export function classifyMt5Rows(rawRows = []) {
  const balanceOps = [];
  const dealRows = [];

  for (const row of rawRows) {
    const typeStr = (row.type || '').toLowerCase();
    const entryStr = (row.entryType || '').toLowerCase();

    // Check if row is a balance operation (deposit, withdrawal, credit, bonus, fee adjustment)
    if (
      typeStr === 'balance' ||
      typeStr === 'credit' ||
      typeStr === 'deposit' ||
      typeStr === 'withdrawal' ||
      typeStr.includes('balance') ||
      (!row.symbol && row.profit !== 0 && (!row.volume || row.volume === 0))
    ) {
      balanceOps.push({
        dealId: row.dealId,
        time: row.time,
        type: typeStr.includes('withdraw') || row.profit < 0 ? 'withdrawal' : 'deposit',
        amount: row.profit || 0,
        comment: row.rawCells ? row.rawCells.join(' ') : 'MT5 Balance Operation',
      });
    } else if (typeStr === 'buy' || typeStr === 'sell' || entryStr === 'in' || entryStr === 'out' || entryStr === 'inout') {
      dealRows.push(row);
    }
  }

  return { balanceOps, dealRows };
}

/**
 * Groups raw MT5 "Deals" rows by Position ID and separates entry vs exit fills.
 * One logical Trade = one position group with 1 entry deal + 1..N exit deals.
 * @param {Array<Object>} dealRows 
 * @returns {Map<string, { entries: Array, exits: Array }>}
 */
export function groupDealsByPosition(dealRows = []) {
  const positions = new Map();

  for (const row of dealRows) {
    const positionId = row.positionId || row.dealId;
    if (!positionId) continue;

    if (!positions.has(positionId)) {
      positions.set(positionId, { entries: [], exits: [] });
    }

    const group = positions.get(positionId);
    const entryType = (row.entryType || '').toLowerCase();

    // MT5 deal entry field: 'in' = entry, 'out' | 'inout' = exit fill
    if (entryType === 'in') {
      group.entries.push(row);
    } else if (entryType === 'out' || entryType === 'inout' || entryType.includes('out')) {
      group.exits.push(row);
    } else {
      // If entryType is missing, infer by profit or volume
      if (row.profit !== 0) {
        group.exits.push(row);
      } else {
        group.entries.push(row);
      }
    }
  }

  return positions;
}

/**
 * Reduces a position group into a single canonical paired trade object.
 * Handles single-shot and partial closes (1 entry, N exits) by volume-weighting prices.
 * Returns null for active open positions (no exit fills yet).
 * 
 * @param {string} positionId 
 * @param {{ entries: Array, exits: Array }} group 
 * @returns {Object|null}
 */
export function reducePositionToTrade(positionId, group) {
  const { entries, exits } = group;

  // Open position (no exit deals yet) -> return null to skip from closed trade imports
  if (entries.length === 0 || exits.length === 0) {
    return null;
  }

  const entryVolume = sum(entries.map((e) => e.volume));
  const entryPrice = weightedAvg(entries, 'price', 'volume');

  const exitVolume = sum(exits.map((e) => e.volume));
  const exitPrice = weightedAvg(exits, 'price', 'volume');

  const totalProfit = sum(exits.map((e) => e.profit));
  const totalCommission = sum([...entries, ...exits].map((e) => e.commission || 0));
  const totalSwap = sum(exits.map((e) => e.swap || 0));

  const firstEntry = entries[0];
  const lastExit = exits[exits.length - 1];

  const side = (firstEntry.type || firstEntry.dealType || 'buy').toLowerCase() === 'buy' ? 'Buy' : 'Sell';

  return {
    brokerPositionId: String(positionId),
    brokerTicketId: String(firstEntry.dealId || positionId),
    symbol: firstEntry.symbol || 'XAUUSD',
    side,
    entryPrice: parseFloat(entryPrice.toFixed(3)),
    exitPrice: parseFloat(exitPrice.toFixed(3)),
    stopLoss: parseFloat(firstEntry.stopLoss || 0),
    takeProfit: parseFloat(firstEntry.takeProfit || 0),
    lotSize: parseFloat(exitVolume.toFixed(2)),
    openTime: firstEntry.time,
    closeTime: lastExit.time,
    commission: parseFloat(totalCommission.toFixed(2)),
    swap: parseFloat(totalSwap.toFixed(2)),
    pnl: parseFloat(totalProfit.toFixed(2)),
    partialCloseCount: exits.length > 1 ? exits.length : undefined,
    source: 'mt5_import',
  };
}
