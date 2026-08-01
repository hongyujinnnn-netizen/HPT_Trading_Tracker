import { describe, it, expect } from 'vitest';
import { detectMistakes, MISTAKE_TYPES } from '../mistakeDetector';

describe('mistakeDetector utility', () => {
  it('detects No Stop Loss when stopLoss is 0 or missing', () => {
    const tradeWithoutSL = {
      id: 't1',
      stopLoss: 0,
      entryPrice: 2400,
      takeProfit: 2420,
      side: 'Buy',
    };

    const mistakes = detectMistakes(tradeWithoutSL, []);
    expect(mistakes).toContain(MISTAKE_TYPES.NO_STOP_LOSS);
  });

  it('detects Late / Bad Entry when RR < 1.0', () => {
    const badRRTrade = {
      id: 't2',
      side: 'Buy',
      entryPrice: 2400,
      stopLoss: 2390, // Risk = 10
      takeProfit: 2405, // Reward = 5 -> RR = 0.5 < 1.0
      rr: 0.5,
    };

    const mistakes = detectMistakes(badRRTrade, []);
    expect(mistakes).toContain(MISTAKE_TYPES.BAD_ENTRY);
  });

  it('detects News Gambling when trade timestamp is near high impact event', () => {
    // US PCE event timestamp in newsCalendar is '2026-07-30T12:30:00Z'
    const newsTrade = {
      id: 't3',
      timestamp: '2026-07-30T12:35:00Z', // 5 minutes after PCE release
      stopLoss: 2400,
      entryPrice: 2410,
      takeProfit: 2430,
      rr: 2.0,
    };

    const mistakes = detectMistakes(newsTrade, []);
    expect(mistakes).toContain(MISTAKE_TYPES.NEWS_GAMBLING);
  });

  it('detects Overtrading when >3 trades occur within 60 minutes', () => {
    const existing = [
      { id: 't1', timestamp: '2026-07-29T10:00:00Z', stopLoss: 2400 },
      { id: 't2', timestamp: '2026-07-29T10:15:00Z', stopLoss: 2400 },
      { id: 't3', timestamp: '2026-07-29T10:30:00Z', stopLoss: 2400 },
    ];

    const newTrade = {
      id: 't4',
      timestamp: '2026-07-29T10:45:00Z', // 4th trade in same hour
      stopLoss: 2400,
      entryPrice: 2410,
      takeProfit: 2430,
      rr: 2.0,
    };

    const mistakes = detectMistakes(newTrade, existing);
    expect(mistakes).toContain(MISTAKE_TYPES.OVERTRADING);
  });

  it('detects Revenge Trade when taken right after a losing trade with scaled lot size', () => {
    const losingTrade = {
      id: 't1',
      timestamp: '2026-07-29T14:00:00Z',
      pnl: -200,
      lotSize: 0.5,
    };

    const revengeTrade = {
      id: 't2',
      timestamp: '2026-07-29T14:10:00Z', // 10 mins later (<= 15 mins)
      lotSize: 0.5, // lot size >= previous losing trade
      stopLoss: 2400,
      entryPrice: 2410,
      takeProfit: 2430,
      rr: 2.0,
    };

    const mistakes = detectMistakes(revengeTrade, [losingTrade]);
    expect(mistakes).toContain(MISTAKE_TYPES.REVENGE_TRADE);
  });
});
