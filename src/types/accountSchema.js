/**
 * Canonical Trading Sub-Account Type Definition
 * 
 * @typedef {Object} TradingAccount
 * @property {string} id - Unique account ID (e.g. 'acc_exness_live_1029')
 * @property {string} name - Account display name (e.g. 'Exness Standard #882194')
 * @property {string} broker - Broker or exchange name (e.g. 'Exness', 'IC Markets', 'FTMO', 'Binance', 'Bybit', 'MetaTrader 5', 'Custom')
 * @property {'live'|'demo'|'challenge'|'backtest'} accountType - Category of trading account
 * @property {string} accountNumber - Optional account/login number (e.g. '8821940')
 * @property {number} initialBalance - Starting capital balance
 * @property {string} currency - Account currency ISO code (e.g. 'USD', 'EUR', 'GBP', 'THB')
 * @property {string} leverage - Account leverage string (e.g. '1:500', '1:100', '1:2000')
 * @property {string} colorHex - Custom badge theme color
 * @property {boolean} isDefault - True if this is the default account on startup
 * @property {boolean} isArchived - True if account is soft-deleted/archived
 * @property {string} createdAt - ISO timestamp
 */

export const BROKER_OPTIONS = [
  'Exness',
  'IC Markets',
  'FTMO',
  'FundedNext',
  'MetaTrader 4',
  'MetaTrader 5',
  'Binance',
  'Bybit',
  'XM',
  'Custom Broker',
];

export const ACCOUNT_TYPE_LABELS = {
  live: 'Live Account',
  demo: 'Demo Account',
  challenge: 'Prop Challenge',
  backtest: 'Backtest Account',
};

/**
 * Creates a normalized TradingAccount object ensuring all default fields are set.
 * @param {Partial<TradingAccount>} data 
 * @returns {TradingAccount}
 */
export function createTradingAccount(data = {}) {
  const now = new Date();
  return {
    id: data.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name || 'Primary Exness MT5',
    broker: data.broker || 'Exness',
    accountType: data.accountType || 'live',
    accountNumber: data.accountNumber || '',
    initialBalance: typeof data.initialBalance === 'number' ? data.initialBalance : (parseFloat(data.initialBalance) || 10000),
    currency: data.currency || 'USD',
    leverage: data.leverage || '1:500',
    colorHex: data.colorHex || '#C9A227',
    currencyMode: data.currencyMode || data.currency_mode || 'standard',
    isDefault: Boolean(data.isDefault),
    isArchived: Boolean(data.isArchived),
    createdAt: data.createdAt || now.toISOString(),
  };
}
