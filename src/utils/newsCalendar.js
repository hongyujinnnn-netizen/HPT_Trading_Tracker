/**
 * Seeded Economic Calendar & Helper Utilities
 * Provides structured high & medium impact economic events for XAU/USD news tracking
 * and automatic "News Gambling" trade detection.
 */

export const ECONOMIC_EVENTS = [
  {
    id: 'news_1',
    title: 'US Core PCE Price Index (MoM / YoY)',
    currency: 'USD',
    impact: 'High',
    timestamp: '2026-07-30T12:30:00Z',
    timeLabel: '12:30 GMT',
    forecast: '0.3%',
    previous: '0.2%',
    note: "Fed's primary inflation benchmark — extreme gold volatility expected during release window.",
  },
  {
    id: 'news_2',
    title: 'US Initial Jobless Claims',
    currency: 'USD',
    impact: 'Medium',
    timestamp: '2026-07-30T12:30:00Z',
    timeLabel: '12:30 GMT',
    forecast: '225K',
    previous: '220K',
    note: 'Labor market indicator — moderate USD and XAU/USD price fluctuations typical.',
  },
  {
    id: 'news_3',
    title: 'FOMC Rate Decision & Press Conference',
    currency: 'USD',
    impact: 'High',
    timestamp: '2026-07-29T18:00:00Z',
    timeLabel: '18:00 GMT',
    forecast: '5.25%',
    previous: '5.25%',
    note: 'Interest rate guidance directly impacts US dollar yield and non-yielding gold attractiveness.',
  },
  {
    id: 'news_4',
    title: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
    currency: 'USD',
    impact: 'High',
    timestamp: '2026-07-25T12:30:00Z',
    timeLabel: '12:30 GMT',
    forecast: '185K',
    previous: '206K',
    note: 'Highest volatility event for XAU/USD; wide spreads and slippage expected.',
  },
  {
    id: 'news_5',
    title: 'US Consumer Price Index (CPI MoM / YoY)',
    currency: 'USD',
    impact: 'High',
    timestamp: '2026-07-22T12:30:00Z',
    timeLabel: '12:30 GMT',
    forecast: '3.1%',
    previous: '3.3%',
    note: 'Headline inflation driver for Fed rate trajectory.',
  },
  {
    id: 'news_6',
    title: 'ISM Manufacturing PMI',
    currency: 'USD',
    impact: 'Medium',
    timestamp: '2026-07-18T14:00:00Z',
    timeLabel: '14:00 GMT',
    forecast: '49.5',
    previous: '48.5',
    note: 'Economic activity indicator — drives intraday trend momentum during NY session opening.',
  },
];

/**
 * Checks whether a given timestamp falls within ±windowMinutes of a High-Impact economic event
 * @param {string|Date} tradeTimestamp 
 * @param {number} [windowMinutes=15] 
 * @returns {{ isNearNews: boolean, event: typeof ECONOMIC_EVENTS[0] | null }}
 */
export function checkNewsWindow(tradeTimestamp, windowMinutes = 15) {
  const tradeTime = new Date(tradeTimestamp).getTime();
  if (isNaN(tradeTime)) return { isNearNews: false, event: null };

  const windowMs = windowMinutes * 60 * 1000;

  for (const event of ECONOMIC_EVENTS) {
    if (event.impact !== 'High') continue;
    const eventTime = new Date(event.timestamp).getTime();
    if (Math.abs(tradeTime - eventTime) <= windowMs) {
      return { isNearNews: true, event };
    }
  }

  return { isNearNews: false, event: null };
}
