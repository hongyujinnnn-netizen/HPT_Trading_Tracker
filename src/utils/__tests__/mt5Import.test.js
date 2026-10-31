import { describe, it, expect } from 'vitest';
import { parseLocaleNumber, parseMt5CsvDeals } from '../../services/mt5Import/mt5CsvParser';
import { classifyMt5Rows, groupDealsByPosition, reducePositionToTrade } from '../../services/mt5Import/mt5RowClassifier';
import { normalizeSymbol, mapPositionToTrade } from '../../services/mt5Import/mt5TradeMapper';
import { diffMt5Import } from '../../services/mt5Import/importDedup';

describe('MT5 Import Pipeline (Parser, Classifier, Mapper & Deduplication)', () => {
  it('parses European, space-separated, and US locale numbers accurately', () => {
    expect(parseLocaleNumber('1 234.56')).toBe(1234.56);
    expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
    expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
    expect(parseLocaleNumber('-45,20')).toBe(-45.2);
    expect(parseLocaleNumber('-')).toBe(0);
  });

  it('normalizes broker gold symbols to XAUUSD', () => {
    expect(normalizeSymbol('XAUUSDm')).toBe('XAUUSD');
    expect(normalizeSymbol('GOLD.pro')).toBe('XAUUSD');
    expect(normalizeSymbol('XAUUSD.a')).toBe('XAUUSD');
  });

  it('pairs partial closes, preserves commission + swap in Net PnL, and scales cent accounts', () => {
    const csv = [
      'Deal;Time;Type;Entry;Symbol;Volume;Price;Position;Commission;Swap;Profit',
      '1001;2026-10-15 09:00:00;buy;in;XAUUSDm;1.0;2650.00;5001;-3.50;0.00;0.00',
      '1002;2026-10-15 10:30:00;sell;out;XAUUSDm;0.5;2660.00;5001;-1.75;0.00;500.00',
      '1003;2026-10-15 11:00:00;sell;out;XAUUSDm;0.5;2670.00;5001;-1.75;-2.00;1000.00',
      '1004;2026-10-15 12:00:00;balance;;0;0;0;0;0;2500.00',
    ].join('\n');

    const rawRows = parseMt5CsvDeals(csv);
    const { balanceOps, dealRows } = classifyMt5Rows(rawRows);
    expect(balanceOps).toHaveLength(1);
    expect(dealRows).toHaveLength(3);

    const groups = groupDealsByPosition(dealRows);
    const reduced = reducePositionToTrade('5001', groups.get('5001'));
    expect(reduced).not.toBeNull();
    expect(reduced.entryPrice).toBe(2650);
    expect(reduced.exitPrice).toBe(2665); // volume-weighted (2660*0.5 + 2670*0.5)
    expect(reduced.lotSize).toBe(1.0);
    expect(reduced.pnl).toBe(1500);
    expect(reduced.partialCloseCount).toBe(2);

    // Map with standard USD account (net = 1500 - (-7) + (-2) or 1500 - commission + swap)
    const usdTrade = mapPositionToTrade(
      { ...reduced, stopLoss: 2640, takeProfit: 2670, commission: 7, swap: -2 },
      { id: 'acc_usd', currencyMode: 'usd' }
    );
    expect(usdTrade.pnl).toBe(1491); // 1500 - 7 - 2
    expect(usdTrade.rr).toBe(2); // (2670 - 2650) / (2650 - 2640)

    // Map with cent account (/ 100 scaling)
    const centTrade = mapPositionToTrade(
      { ...reduced, stopLoss: 2640, takeProfit: 2670, commission: 7, swap: -2 },
      { id: 'acc_cent', currencyMode: 'cent' }
    );
    expect(centTrade.pnl).toBe(14.91);
  });

  it('deduplicates already imported positions by brokerPositionId per sub-account', () => {
    const incoming = [
      { id: 't1', brokerPositionId: '5001', accountId: 'acc_1', pnl: 100 },
      { id: 't2', brokerPositionId: '5002', accountId: 'acc_1', pnl: 250 },
    ];
    const existing = [
      { id: 'ex1', brokerPositionId: '5001', accountId: 'acc_1', pnl: 100 },
    ];

    const diff = diffMt5Import(incoming, [], 0, existing, 'acc_1');
    expect(diff.newTrades).toHaveLength(1);
    expect(diff.newTrades[0].brokerPositionId).toBe('5002');
    expect(diff.duplicateTrades).toHaveLength(1);
    expect(diff.duplicateTrades[0].brokerPositionId).toBe('5001');
  });
});
