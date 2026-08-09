/**
 * MT5 Import Deduplication & Diff Engine
 * Compares incoming parsed MT5 trades against existing trades for the target sub-account
 * using brokerPositionId as the unique anchor.
 */

/**
 * Checks parsed trades against existing store records.
 * 
 * @param {Array<Trade>} parsedTrades - Mapped canonical trade objects ready for import
 * @param {Array<Object>} balanceOps - Raw deposit/withdrawal balance operations
 * @param {number} openPositionCount - Count of unclosed open positions skipped
 * @param {Array<Trade>} existingTrades - All existing trades in database / store
 * @param {string} targetAccountId - ID of target sub-account
 * @returns {{ newTrades: Array<Trade>, duplicateTrades: Array<Trade>, balanceOps: Array<Object>, openPositionCount: number }}
 */
export function diffMt5Import(parsedTrades = [], balanceOps = [], openPositionCount = 0, existingTrades = [], targetAccountId = '') {
  // Filter existing trades for the target account that have a brokerPositionId
  const accountTrades = existingTrades.filter(
    (t) => (t.accountId === targetAccountId || !t.accountId) && t.brokerPositionId
  );

  const existingPositionIds = new Set(accountTrades.map((t) => String(t.brokerPositionId)));

  const newTrades = [];
  const duplicateTrades = [];

  for (const trade of parsedTrades) {
    if (trade.brokerPositionId && existingPositionIds.has(String(trade.brokerPositionId))) {
      duplicateTrades.push(trade);
    } else {
      newTrades.push(trade);
      if (trade.brokerPositionId) {
        existingPositionIds.add(String(trade.brokerPositionId));
      }
    }
  }

  return {
    newTrades,
    duplicateTrades,
    balanceOps,
    openPositionCount,
  };
}
