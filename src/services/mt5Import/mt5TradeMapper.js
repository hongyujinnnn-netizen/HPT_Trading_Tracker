/**
 * MT5 Symbol Normalizer & Trade Mapper
 * Handles broker symbol quirks (XAUUSDm, GOLD, XAUUSD.a -> XAUUSD)
 * and cent account scaling (/ 100).
 */

import { createTrade } from '../../types/tradeSchema';
import { getActiveSessionName } from '../../utils/sessionDetector';
import { calculateRR } from '../../utils/calculations';

/**
 * Normalizes broker symbol names to canonical XAUUSD instrument.
 */
export function normalizeSymbol(rawSymbol = '') {
  if (!rawSymbol) return 'XAUUSD';
  const s = rawSymbol.trim().toUpperCase();

  if (s === 'GOLD' || s.startsWith('XAU') || s.startsWith('GOLD')) {
    return 'XAUUSD';
  }

  // Strip broker suffixes (e.g. XAUUSDm, XAUUSD.a, XAUUSD_i, XAUUSD#)
  const cleaned = s.replace(/[^A-Z]/g, '');
  if (cleaned.includes('XAUUSD') || cleaned.includes('GOLD')) {
    return 'XAUUSD';
  }

  return 'XAUUSD';
}

/**
 * Maps paired position trade to canonical Trade schema object.
 * Applies cent-account scaling (/ 100) if target account has currencyMode = 'cent'.
 * 
 * @param {Object} positionTrade 
 * @param {Object} account 
 * @returns {Trade}
 */
export function mapPositionToTrade(positionTrade, account = {}) {
  const isCent = account.currencyMode === 'cent';
  const scaleFactor = isCent ? 100 : 1;

  const rawPnl = positionTrade.pnl || 0;
  const rawCommission = positionTrade.commission || 0;
  const rawSwap = positionTrade.swap || 0;

  // Net PnL = gross profit - commission + swap
  const netPnl = (rawPnl - rawCommission + rawSwap) / scaleFactor;

  const timestamp = positionTrade.openTime
    ? new Date(positionTrade.openTime).toISOString()
    : new Date().toISOString();

  const side = positionTrade.side || 'Buy';
  const entryPrice = parseFloat(positionTrade.entryPrice) || 0;
  const exitPrice = parseFloat(positionTrade.exitPrice) || 0;
  const stopLoss = parseFloat(positionTrade.stopLoss) || 0;
  const takeProfit = parseFloat(positionTrade.takeProfit) || 0;
  const computedRR = calculateRR(side, entryPrice, stopLoss, takeProfit || exitPrice);

  return createTrade({
    accountId: account.id || null,
    brokerPositionId: positionTrade.brokerPositionId,
    brokerTicketId: positionTrade.brokerTicketId,
    symbol: normalizeSymbol(positionTrade.symbol),
    side,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize: positionTrade.lotSize || 0.1,
    pnl: parseFloat(netPnl.toFixed(2)),
    rr: computedRR > 0 ? computedRR : 0,
    strategy: 'Breakout',
    session: getActiveSessionName(new Date(timestamp)),
    marketCondition: 'Trending',
    emotion: 'Planned',
    notes: positionTrade.partialCloseCount
      ? `Imported from MT5 (Position #${positionTrade.brokerPositionId}, ${positionTrade.partialCloseCount} partial exit fills)`
      : `Imported from MT5 (Position #${positionTrade.brokerPositionId})`,
    timestamp,
    date: timestamp.split('T')[0],
    source: 'mt5_import',
    partialCloseCount: positionTrade.partialCloseCount,
  });
}
