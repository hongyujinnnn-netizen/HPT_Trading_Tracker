import { describe, it, expect, vi } from 'vitest';
import { supabaseStore } from '../../services/supabaseStore';

describe('Local Trades Cloud Migration Idempotency', () => {
  it('prevents inserting duplicate trades on double invocation', async () => {
    const mockUser = 'test-user-uuid';
    const sampleLocalTrades = [
      {
        id: 'local_1',
        timestamp: '2026-08-01T10:00:00Z',
        side: 'Buy',
        entryPrice: 2400.0,
        exitPrice: 2410.0,
        lotSize: 1.0,
        notes: 'Breakout trade',
      },
    ];

    // Mock supabase select returning empty on 1st invocation, existing row on 2nd invocation
    let existingRows = [];

    const mockInsert = vi.fn().mockImplementation((rows) => {
      existingRows.push(...rows);
      return Promise.resolve({ error: null });
    });

    const mockSelect = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({
        data: existingRows.map((r) => ({
          entry_time: r.entry_time,
          entry_price: r.entry_price,
          lot_size: r.lot_size,
        })),
      }),
    }));

    vi.spyOn(supabaseStore, 'migrateLocalTradesToCloud').mockImplementation(async (userId, trades) => {
      const existingKeys = new Set(
        existingRows.map((t) => `${t.entry_time}_${t.entry_price}_${t.lot_size}`)
      );

      const rowsToInsert = trades
        .filter((t) => {
          const entryTime = t.timestamp;
          const key = `${entryTime}_${parseFloat(t.entryPrice)}_${parseFloat(t.lotSize)}`;
          return !existingKeys.has(key);
        })
        .map((t) => ({
          user_id: userId,
          entry_price: parseFloat(t.entryPrice),
          lot_size: parseFloat(t.lotSize),
          entry_time: t.timestamp,
        }));

      if (rowsToInsert.length > 0) {
        await mockInsert(rowsToInsert);
      }
      return true;
    });

    // 1st Invocation
    const result1 = await supabaseStore.migrateLocalTradesToCloud(mockUser, sampleLocalTrades);
    expect(result1).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    // 2nd Invocation (Double-invocation test)
    const result2 = await supabaseStore.migrateLocalTradesToCloud(mockUser, sampleLocalTrades);
    expect(result2).toBe(true);
    // Insert should not be called again because trade key already exists
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(existingRows.length).toBe(1);
  });
});
