/**
 * Symbol Safety Guard
 * Restricts trade execution & journaling logic strictly to Spot Gold (XAUUSD).
 * Crypto gold proxies (PAXG, XAUT) are allowed ONLY for 24/7 chart display/visualization.
 */

/**
 * Checks if a symbol is allowed for logging/execution in the trade journal.
 * @param {string} [symbol]
 * @returns {boolean}
 */
export function isTradeableSymbol(symbol) {
  if (!symbol) return true; // Default standard XAUUSD
  const s = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Block crypto gold proxies from trade logging/execution
  if (s.includes('PAXG') || s.includes('XAUT')) {
    return false;
  }
  
  return s === 'XAUUSD' || s === 'GOLD' || s === 'XAU';
}
