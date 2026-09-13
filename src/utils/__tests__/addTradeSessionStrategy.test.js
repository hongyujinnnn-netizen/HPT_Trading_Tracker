import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabaseStore } from '../../services/supabaseStore';
import { supabase } from '../../services/supabaseClient';
import { mapPositionToTrade } from '../../services/mt5Import/mt5TradeMapper';
import { parseCSV } from '../csvParser';

describe('Add Trade Session and Strategy Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves session IDs correctly', async () => {
    expect(await supabaseStore.getSessionId('Asian')).toBe(1);
    expect(await supabaseStore.getSessionId('Asian Session')).toBe(1);
    expect(await supabaseStore.getSessionId('London')).toBe(2);
    expect(await supabaseStore.getSessionId('London Session')).toBe(2);
    expect(await supabaseStore.getSessionId('New York')).toBe(3);
    expect(await supabaseStore.getSessionId('New York Session')).toBe(3);
    expect(await supabaseStore.getSessionId('London Close')).toBe(4);
  });

  it('resolves or creates strategy ID in Supabase', async () => {
    const mockUserId = 'user-uuid-123';
    
    // Mock strategy query returning an existing strategy
    vi.spyOn(supabase, 'from').mockImplementation((table) => {
      if (table === 'strategies') {
        return {
          select: () => ({
            eq: () => ({
              ilike: () => ({
                maybeSingle: async () => ({
                  data: { id: 'strat-uuid-pullback', name: 'Pullback' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const strategyId = await supabaseStore.getOrCreateStrategyId(mockUserId, 'Pullback');
    expect(strategyId).toBe('strat-uuid-pullback');
  });

  it('persists and returns selected strategy and session in addTrade', async () => {
    const mockUserId = 'user-uuid-456';
    let insertedRow = null;

    vi.spyOn(supabaseStore, 'getOrCreateStrategyId').mockResolvedValue('strat-custom-123');
    vi.spyOn(supabaseStore, 'getSessionId').mockResolvedValue(3); // New York

    vi.spyOn(supabase, 'from').mockImplementation((table) => {
      if (table === 'trades') {
        return {
          insert: (rows) => {
            insertedRow = rows[0];
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'tr_custom_999',
                    user_id: mockUserId,
                    side: insertedRow.side,
                    entry_price: insertedRow.entry_price,
                    exit_price: insertedRow.exit_price,
                    lot_size: insertedRow.lot_size,
                    entry_time: insertedRow.entry_time,
                    exit_time: insertedRow.exit_time,
                    pnl: 150,
                    rr_ratio: 2.5,
                    strategy_id: insertedRow.strategy_id,
                    session_id: insertedRow.session_id,
                    strategies: { name: 'FVG Liquidity Sweep' },
                    sessions: { name: 'New York' },
                    trade_mistakes: [],
                    trade_screenshots: [],
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      return {};
    });

    const tradeInput = {
      side: 'Buy',
      entryPrice: 2650,
      exitPrice: 2665,
      stopLoss: 2644,
      takeProfit: 2665,
      lotSize: 1.0,
      strategy: 'FVG Liquidity Sweep',
      session: 'New York',
      marketCondition: 'Trending',
      emotion: 'Planned',
      notes: 'Testing NY setup',
      timestamp: '2026-09-13T18:00:00Z',
    };

    const result = await supabaseStore.addTrade(tradeInput, mockUserId);

    // Verify insertedRow contains strategy_id and session_id
    expect(insertedRow).toBeTruthy();
    expect(insertedRow.strategy_id).toBe('strat-custom-123');
    expect(insertedRow.session_id).toBe(3);

    // Verify mapped trade preserves the selected strategy and session
    expect(result.strategy).toBe('FVG Liquidity Sweep');
    expect(result.session).toBe('New York');
    expect(result.strategy).not.toBe('Breakout');
    expect(result.session).not.toBe('London');
  });

  it('mt5TradeMapper dynamically detects session from trade open time', () => {
    // 04:00 UTC -> Asian
    const asianTrade = mapPositionToTrade({
      brokerPositionId: '1001',
      openTime: '2026-09-10T04:00:00Z',
      symbol: 'XAUUSD',
      side: 'Buy',
      entryPrice: 2600,
      exitPrice: 2610,
      lotSize: 0.1,
      pnl: 100,
    });
    expect(asianTrade.session).toBe('Asian');

    // 18:00 UTC -> New York
    const nyTrade = mapPositionToTrade({
      brokerPositionId: '1002',
      openTime: '2026-09-10T18:00:00Z',
      symbol: 'XAUUSD',
      side: 'Sell',
      entryPrice: 2610,
      exitPrice: 2600,
      lotSize: 0.1,
      pnl: 100,
    });
    expect(nyTrade.session).toBe('New York');
  });

  it('csvParser preserves custom strategy and session', () => {
    const csvContent = `Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Swap,Profit,Strategy,Session
10001,2026-09-10 18:00:00,Buy,0.5,XAUUSD,2600.00,2590.00,2620.00,2026-09-10 18:30:00,2615.00,0,0,750,Order Block / ICT,New York`;

    const trades = parseCSV(csvContent);
    expect(trades.length).toBe(1);
    expect(trades[0].strategy).toBe('Order Block / ICT');
    expect(trades[0].session).toBe('New York');
  });
});
