import { supabase } from './supabaseClient';
import { createTrade } from '../types/tradeSchema';

/**
 * Maps database row to canonical Trade object
 */
function mapRowToTrade(row) {
  const mistakesList = Array.isArray(row.trade_mistakes)
    ? row.trade_mistakes.map((m) => m.mistake_types?.label || m.mistake_types?.code).filter(Boolean)
    : [];

  const screenshotPath = Array.isArray(row.trade_screenshots) && row.trade_screenshots.length > 0
    ? row.trade_screenshots[0].storage_path
    : null;

  return createTrade({
    id: row.id,
    timestamp: row.entry_time,
    date: row.entry_time ? row.entry_time.split('T')[0] : new Date().toISOString().split('T')[0],
    side: row.side === 'buy' ? 'Buy' : 'Sell',
    entryPrice: parseFloat(row.entry_price) || 0,
    exitPrice: parseFloat(row.exit_price) || 0,
    stopLoss: parseFloat(row.stop_loss) || 0,
    takeProfit: parseFloat(row.take_profit) || 0,
    lotSize: parseFloat(row.lot_size) || 0.1,
    pnl: parseFloat(row.pnl) || 0,
    rr: parseFloat(row.rr_ratio) || 0,
    strategy: row.strategies?.name || 'Breakout',
    session: row.sessions?.name || 'London',
    marketCondition: row.market_condition ? row.market_condition.replace('_', ' ') : 'Trending',
    emotion: row.emotion ? row.emotion.replace('_', ' ') : 'Planned',
    mistakes: mistakesList,
    notes: row.notes || row.reason_for_entry || '',
    imageId: screenshotPath,
    ticket: row.id.substring(0, 8),
  });
}

export const supabaseStore = {
  /**
   * Fetch all trades for current authenticated user
   */
  async getAllTrades() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          strategies(name),
          sessions(name),
          trade_mistakes(mistake_types(label, code)),
          trade_screenshots(storage_path)
        `)
        .order('entry_time', { ascending: false });

      if (error) {
        console.error('Supabase getAllTrades error:', error);
        return [];
      }

      return (data || []).map(mapRowToTrade);
    } catch (e) {
      console.error('Failed to fetch trades from Supabase:', e);
      return [];
    }
  },

  /**
   * Fetch aggregate views directly from PostgreSQL views
   */
  async getDashboardViews() {
    if (!supabase) return null;
    try {
      const [statsRes, equityRes, sessionRes, strategyRes, mistakeCostRes] = await Promise.all([
        supabase.from('view_dashboard_stats').select('*').maybeSingle(),
        supabase.from('view_equity_curve').select('*'),
        supabase.from('view_session_performance').select('*'),
        supabase.from('view_strategy_performance').select('*'),
        supabase.from('view_mistake_cost').select('*'),
      ]);

      return {
        stats: statsRes.data || null,
        equityCurve: equityRes.data || [],
        sessionPerformance: sessionRes.data || [],
        strategyPerformance: strategyRes.data || [],
        mistakeCost: mistakeCostRes.data || [],
      };
    } catch (e) {
      console.error('Failed to fetch Supabase dashboard views:', e);
      return null;
    }
  },

  /**
   * Fetch economic events calendar from economic_events table
   */
  async getEconomicEvents() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('economic_events')
        .select('*')
        .order('event_time', { ascending: false });

      if (error) {
        console.error('Supabase getEconomicEvents error:', error);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('Failed to fetch economic events from Supabase:', e);
      return [];
    }
  },

  /**
   * Save a new trade to Supabase DB
   */
  async addTrade(tradeData, userId) {
    if (!supabase || !userId) return null;

    try {
      const dbRow = {
        user_id: userId,
        symbol: 'XAUUSD',
        side: (tradeData.side || 'Buy').toLowerCase(),
        status: 'closed',
        entry_price: parseFloat(tradeData.entryPrice) || 0,
        exit_price: parseFloat(tradeData.exitPrice) || 0,
        lot_size: parseFloat(tradeData.lotSize) || 0.1,
        stop_loss: parseFloat(tradeData.stopLoss) || null,
        take_profit: parseFloat(tradeData.takeProfit) || null,
        entry_time: tradeData.timestamp || new Date().toISOString(),
        exit_time: tradeData.timestamp || new Date().toISOString(),
        emotion: (tradeData.emotion || 'planned').toLowerCase().replace(/\s+/g, '_'),
        reason_for_entry: tradeData.notes || '',
        notes: tradeData.notes || '',
      };

      const { data, error } = await supabase
        .from('trades')
        .insert([dbRow])
        .select(`
          *,
          strategies(name),
          sessions(name),
          trade_mistakes(mistake_types(label, code)),
          trade_screenshots(storage_path)
        `)
        .single();

      if (error) {
        console.error('Supabase addTrade error:', error);
        return null;
      }

      return mapRowToTrade(data);
    } catch (e) {
      console.error('Failed to add trade to Supabase:', e);
      return null;
    }
  },

  /**
   * Delete a trade from Supabase
   */
  async deleteTrade(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('trades').delete().eq('id', id);
    return !error;
  },

  /**
   * Delete all trades for a user from Supabase
   */
  async deleteAllTrades(userId) {
    if (!supabase || !userId) return false;
    const { error } = await supabase.from('trades').delete().eq('user_id', userId);
    return !error;
  },

  /**
   * Upload screenshot to Supabase Storage bucket 'trade-screenshots'
   * Folder path structure matches RLS Policy: {userId}/{tradeId}/entry.png
   */
  async uploadScreenshot(tradeId, userId, fileOrBlob) {
    if (!supabase || !userId) return null;
    try {
      const storagePath = `${userId}/${tradeId}/entry.png`;
      const { data, error } = await supabase.storage
        .from('trade-screenshots')
        .upload(storagePath, fileOrBlob, { upsert: true });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      await supabase.from('trade_screenshots').insert([
        {
          trade_id: tradeId,
          storage_path: data.path,
        },
      ]);

      return data.path;
    } catch (e) {
      console.error('Failed to upload screenshot to Supabase Storage:', e);
      return null;
    }
  },

  /**
   * Fetch user settings from user_settings table
   */
  async getSettings(userId) {
    if (!supabase || !userId) return null;
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    return data;
  },

  /**
   * Save user settings to user_settings table
   */
  async saveSettings(userId, settingsData) {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...settingsData })
      .select()
      .single();

    if (error) console.error('Supabase saveSettings error:', error);
    return data;
  },

  /**
   * Batch migrate local trades to Supabase cloud safely & idempotently
   */
  async migrateLocalTradesToCloud(userId, localTrades = []) {
    if (!supabase || !userId || !localTrades.length) return true;

    try {
      // Fetch existing trades to prevent duplicate insertions
      const { data: existing } = await supabase
        .from('trades')
        .select('entry_time, entry_price, lot_size')
        .eq('user_id', userId);

      const existingKeys = new Set(
        (existing || []).map(
          (t) => `${t.entry_time}_${t.entry_price}_${t.lot_size}`
        )
      );

      const rowsToInsert = localTrades
        .filter((t) => {
          const entryTime = t.timestamp || new Date().toISOString();
          const key = `${entryTime}_${parseFloat(t.entryPrice) || 0}_${parseFloat(t.lotSize) || 0.1}`;
          return !existingKeys.has(key);
        })
        .map((t) => ({
          user_id: userId,
          symbol: 'XAUUSD',
          side: (t.side || 'Buy').toLowerCase(),
          status: 'closed',
          entry_price: parseFloat(t.entryPrice) || 0,
          exit_price: parseFloat(t.exitPrice) || 0,
          lot_size: parseFloat(t.lotSize) || 0.1,
          stop_loss: parseFloat(t.stopLoss) || null,
          take_profit: parseFloat(t.takeProfit) || null,
          entry_time: t.timestamp || new Date().toISOString(),
          exit_time: t.timestamp || new Date().toISOString(),
          emotion: (t.emotion || 'planned').toLowerCase().replace(/\s+/g, '_'),
          reason_for_entry: t.notes || '',
          notes: t.notes || '',
        }));

      if (rowsToInsert.length === 0) {
        // Nothing new to insert
        return true;
      }

      const { error } = await supabase.from('trades').insert(rowsToInsert);

      if (error) {
        console.error('Supabase migrateLocalTradesToCloud error:', error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Failed to migrate local trades to cloud:', e);
      return false;
    }
  },

  /**
   * Fetch latest XAU/USD price snapshot from public.price_snapshots
   */
  async getLatestPriceSnapshot() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('price_snapshots')
        .select('*')
        .eq('symbol', 'XAUUSD')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Supabase getLatestPriceSnapshot error:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Failed to fetch latest price snapshot:', e);
      return null;
    }
  },

  /**
   * Fetch 24-hour price feed health diagnostics (GoldAPI vs Simulated counts)
   */
  async getPriceFeedHealth24h() {
    if (!supabase) return null;
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('price_snapshots')
        .select('source')
        .gte('captured_at', since24h);

      if (error) return null;

      const health = {
        goldapi: 0,
        simulated: 0,
        unknown: 0,
        total: (data || []).length,
      };

      (data || []).forEach((row) => {
        const src = row.source || 'unknown';
        if (src in health) {
          health[src]++;
        } else {
          health.unknown++;
        }
      });

      return health;
    } catch (e) {
      console.error('Failed to fetch price feed health diagnostics:', e);
      return null;
    }
  },

  /**
   * Subscribe to Supabase Realtime INSERT events on public.price_snapshots
   */
  subscribeToGoldPrice(onNewSnapshot) {
    if (!supabase) return null;

    const channel = supabase
      .channel('gold-price-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_snapshots' },
        (payload) => {
          if (payload?.new && onNewSnapshot) {
            onNewSnapshot(payload.new);
          }
        }
      )
      .subscribe();

    return channel;
  },

  // ── Pending Orders CRUD ──────────────────────────────────────────

  async getActiveOrders() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('pending_orders')
        .select('*')
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });
      if (error) { console.error('getActiveOrders error:', error); return []; }
      return data || [];
    } catch (e) { console.error('Failed to fetch active orders:', e); return []; }
  },

  async getAllOrders() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('pending_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('getAllOrders error:', error); return []; }
      return data || [];
    } catch (e) { console.error('Failed to fetch all orders:', e); return []; }
  },

  async createPendingOrder(orderData, userId) {
    if (!supabase || !userId) return null;
    try {
      const row = {
        user_id: userId,
        symbol: 'XAUUSD',
        order_type: orderData.orderType,
        status: 'pending',
        entry_price: parseFloat(orderData.entryPrice),
        stop_loss: parseFloat(orderData.stopLoss),
        take_profit: parseFloat(orderData.takeProfit),
        lot_size: parseFloat(orderData.lotSize) || 0.1,
        strategy: orderData.strategy || null,
        session: orderData.session || null,
        notes: orderData.notes || null,
        expires_at: orderData.expiresAt || null,
      };
      const { data, error } = await supabase
        .from('pending_orders')
        .insert([row])
        .select()
        .single();
      if (error) { console.error('createPendingOrder error:', error); return null; }
      return data;
    } catch (e) { console.error('Failed to create pending order:', e); return null; }
  },

  async updateOrderStatus(orderId, updates) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('pending_orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
      if (error) { console.error('updateOrderStatus error:', error); return null; }
      return data;
    } catch (e) { console.error('Failed to update order status:', e); return null; }
  },

  async cancelOrder(orderId) {
    return this.updateOrderStatus(orderId, {
      status: 'cancelled',
      closed_at: new Date().toISOString(),
    });
  },

  async deletePendingOrder(orderId) {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('pending_orders').delete().eq('id', orderId);
      if (error) { console.error('deletePendingOrder error:', error); return false; }
      return true;
    } catch (e) { console.error('Failed to delete pending order:', e); return false; }
  },

  async clearOrderHistory(userId) {
    if (!supabase || !userId) return false;
    try {
      const { error } = await supabase
        .from('pending_orders')
        .delete()
        .eq('user_id', userId)
        .in('status', ['closed_tp', 'closed_sl', 'cancelled', 'expired']);
      if (error) { console.error('clearOrderHistory error:', error); return false; }
      return true;
    } catch (e) { console.error('Failed to clear order history:', e); return false; }
  },

  async linkOrderToTrade(orderId, tradeId) {
    return this.updateOrderStatus(orderId, {
      resulting_trade_id: tradeId,
    });
  }
};
