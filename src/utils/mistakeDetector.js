/**
 * Automated Mistake Detector Rule Engine
 * Evaluates trade parameters and historical context to detect behavioral trading leaks.
 */

import { checkNewsWindow } from './newsCalendar';
import { calculateRR } from './calculations';

export const MISTAKE_TYPES = {
  NO_STOP_LOSS: 'No Stop Loss',
  OVERTRADING: 'Overtrading',
  REVENGE_TRADE: 'Revenge Trade',
  NEWS_GAMBLING: 'News Gambling',
  BAD_ENTRY: 'Late / Bad Entry',
};

/**
 * Detects all trading mistakes for a target trade given historical trades array.
 * 
 * @param {import('../types/tradeSchema').Trade} newTrade - Trade being saved or evaluated
 * @param {import('../types/tradeSchema').Trade[]} [allTrades=[]] - Existing trades database
 * @returns {string[]} Array of identified mistake tags
 */
export function detectMistakes(newTrade, allTrades = []) {
  const mistakes = [];
  if (!newTrade) return mistakes;

  // Rule 1: No Stop Loss
  const sl = parseFloat(newTrade.stopLoss);
  if (!sl || sl <= 0 || isNaN(sl)) {
    mistakes.push(MISTAKE_TYPES.NO_STOP_LOSS);
  }

  // Rule 2: Late / Bad Entry
  // RR < 1.0 or entry price distance warning
  const rr = newTrade.rr || calculateRR(newTrade.side, newTrade.entryPrice, newTrade.stopLoss, newTrade.takeProfit);
  if (rr > 0 && rr < 1.0) {
    mistakes.push(MISTAKE_TYPES.BAD_ENTRY);
  }

  // Rule 3: News Gambling (Entry within ±15 minutes of High-Impact Event)
  const { isNearNews } = checkNewsWindow(newTrade.timestamp || newTrade.date, 15);
  if (isNearNews) {
    mistakes.push(MISTAKE_TYPES.NEWS_GAMBLING);
  }

  // Compare against historical trades for context-dependent rules
  if (allTrades && allTrades.length > 0) {
    const tradeTime = new Date(newTrade.timestamp || newTrade.date).getTime();
    const tradeDate = newTrade.date || (newTrade.timestamp ? newTrade.timestamp.split('T')[0] : '');

    // Exclude the current trade itself if it's already in allTrades
    const otherTrades = allTrades.filter((t) => t.id !== newTrade.id);

    // Rule 4: Overtrading
    // (a) > 3 trades within rolling 60-minute window
    // (b) > 5 trades on the same calendar day
    const oneHourMs = 60 * 60 * 1000;
    const tradesInWindow = otherTrades.filter((t) => {
      const tTime = new Date(t.timestamp || t.date).getTime();
      return Math.abs(tradeTime - tTime) <= oneHourMs;
    });

    const tradesOnSameDay = otherTrades.filter((t) => (t.date || '').startsWith(tradeDate));

    if (tradesInWindow.length >= 3 || tradesOnSameDay.length >= 5) {
      mistakes.push(MISTAKE_TYPES.OVERTRADING);
    }

    // Rule 5: Revenge Trade
    // Entry within 15 minutes after a closed losing trade where lotSize >= losingTrade.lotSize
    const fifteenMinMs = 15 * 60 * 1000;
    const recentLosingTrade = otherTrades.find((t) => {
      const tTime = new Date(t.timestamp || t.date).getTime();
      const timeDiff = tradeTime - tTime; // trade opened AFTER losing trade
      const isAfter = timeDiff > 0 && timeDiff <= fifteenMinMs;
      const isLoss = (t.pnl || 0) < 0;
      const isLotEqualOrHigher = (newTrade.lotSize || 0) >= (t.lotSize || 0);
      return isAfter && isLoss && isLotEqualOrHigher;
    });

    if (recentLosingTrade) {
      mistakes.push(MISTAKE_TYPES.REVENGE_TRADE);
    }
  }

  // Preserve explicit emotion tags if user manually set them
  if (newTrade.emotion === 'Revenge Trade' && !mistakes.includes(MISTAKE_TYPES.REVENGE_TRADE)) {
    mistakes.push(MISTAKE_TYPES.REVENGE_TRADE);
  }
  if (newTrade.emotion === 'Late Entry' && !mistakes.includes(MISTAKE_TYPES.BAD_ENTRY)) {
    mistakes.push(MISTAKE_TYPES.BAD_ENTRY);
  }

  return Array.from(new Set(mistakes));
}
