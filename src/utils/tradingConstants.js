/**
 * Canonical trading constants shared across AddTrade, TradeHistory, Dashboard,
 * StrategyCompare, and analytics widgets.
 */

export const STANDARD_STRATEGIES = [
  'Breakout',
  'Pullback',
  'News Trading',
  'London Breakout',
  'News Fade',
  'Order Block / ICT',
  'FVG Liquidity Sweep',
  'Trend Following',
  'Range Scalp',
];

export const TRADING_SESSIONS = [
  { name: 'Asian', hours: '00:00–08:00 GMT' },
  { name: 'London', hours: '08:00–16:00 GMT' },
  { name: 'New York', hours: '13:00–21:00 GMT' },
  { name: 'London Close', hours: '16:00–17:00 GMT' },
];
