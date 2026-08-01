/**
 * Canonical Trade Type Definition
 * 
 * @typedef {Object} Trade
 * @property {string} id - Unique ID (e.g. 'tr_1700000000000')
 * @property {string} timestamp - ISO timestamp (e.g. '2026-07-29T14:30:00Z')
 * @property {string} date - Date string YYYY-MM-DD
 * @property {'Buy'|'Sell'} side - Trade direction
 * @property {number} entryPrice - Price entered
 * @property {number} exitPrice - Price exited
 * @property {number} stopLoss - Price of Stop Loss (0 if no SL set)
 * @property {number} takeProfit - Price of Take Profit (0 if no TP set)
 * @property {number} lotSize - Position volume in standard lots
 * @property {number} pnl - Net P&L in USD
 * @property {number} rr - Realized or planned Risk:Reward ratio
 * @property {'Breakout'|'Pullback'|'News Trading'|'Order Block / ICT'|'Trend Following'|'Range Scalp'} strategy
 * @property {'Asian'|'London'|'New York'|'London Close'} session
 * @property {'Trending'|'Ranging'|'High Volatility'|'Low Volatility'} marketCondition
 * @property {'Planned'|'Emotional'|'Late Entry'|'Revenge Trade'|'FOMO'|'Overtrading'} emotion
 * @property {string[]} mistakes - Array of mistake flags identified automatically or manually
 * @property {string} notes - Trade rationale and retrospective notes
 * @property {string|null} imageId - ID key for screenshot stored in IndexedDB
 * @property {string} [ticket] - Optional MT4/MT5 Ticket number
 */

/**
 * Creates a normalized Trade object ensuring all fields conform to canonical schema.
 * @param {Partial<Trade>} data 
 * @returns {Trade}
 */
export function createTrade(data = {}) {
  const now = new Date();
  const entryPrice = parseFloat(data.entryPrice) || 0;
  const exitPrice = parseFloat(data.exitPrice) || 0;
  const stopLoss = parseFloat(data.stopLoss) || 0;
  const takeProfit = parseFloat(data.takeProfit) || 0;
  const lotSize = parseFloat(data.lotSize) || 0.1;
  const side = data.side === 'Sell' ? 'Sell' : 'Buy';

  return {
    id: data.id || `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: data.timestamp || now.toISOString(),
    date: data.date || now.toISOString().split('T')[0],
    side,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize,
    pnl: typeof data.pnl === 'number' ? data.pnl : 0,
    rr: typeof data.rr === 'number' ? data.rr : 0,
    strategy: data.strategy || 'Breakout',
    session: data.session || 'London',
    marketCondition: data.marketCondition || 'Trending',
    emotion: data.emotion || 'Planned',
    mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
    notes: data.notes || '',
    imageId: data.imageId || null,
    ticket: data.ticket || '',
  };
}
