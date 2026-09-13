import { supabase } from './supabaseClient';
import { createTrade } from '../types/tradeSchema';
import { getActiveSessionName } from '../utils/sessionDetector';

const SESSION_NAME_TO_ID = {
  'asian': 1,
  'asia': 1,
  'sydney': 1,
  'london': 2,
  'europe': 2,
  'european': 2,
  'new york': 3,
  'ny': 3,
  'london close': 4,
  'london / ny overlap': 3,
};

const SESSION_ID_TO_NAME = {
  1: 'Asian',
  2: 'London',
  3: 'New York',
  4: 'London Close',
};

function mapSessionNameToId(sessionName) {
  if (!sessionName) return null;
  const clean = String(sessionName).toLowerCase().replace(/\s*session\s*$/i, '').trim();
  return SESSION_NAME_TO_ID[clean] || null;
}

function mapSessionIdToName(sessionId) {
  return SESSION_ID_TO_NAME[sessionId] || 'London';
}

function mapMarketConditionToDb(condition) {
  if (!condition) return 'trending';
  const c = condition.toLowerCase().trim();
  if (c.includes('range')) return 'ranging';
  if (c.includes('high') || c.includes('volatil')) return 'volatile';
  if (c.includes('low') || c.includes('quiet')) return 'quiet';
  if (c.includes('news')) return 'news_driven';
  return 'trending';
}

function mapDbToMarketCondition(dbVal) {
  if (!dbVal) return 'Trending';
  const val = dbVal.toLowerCase();
  if (val === 'ranging') return 'Ranging';
  if (val === 'volatile') return 'High Volatility';
  if (val === 'quiet') return 'Low Volatility';
  if (val === 'news_driven') return 'High Volatility';
  return 'Trending';
}

function mapEmotionToDb(emotion) {
  if (!emotion) return 'planned';
  const e = emotion.toLowerCase().replace(/\s+/g, '_');
  const valid = ['planned', 'emotional', 'revenge_trade', 'late_entry', 'overtrading', 'fomo', 'disciplined'];
  if (valid.includes(e)) return e;
  if (e.includes('fomo')) return 'fomo';
  if (e.includes('revenge')) return 'revenge_trade';
  if (e.includes('late')) return 'late_entry';
  if (e.includes('overtrade') || e.includes('overleveraged') || e.includes('greedy')) return 'overtrading';
  if (e.includes('hesitant') || e.includes('impulsive') || e.includes('overconfident') || e.includes('emotional')) return 'emotional';
  if (e.includes('disciplined')) return 'disciplined';
  return 'planned';
}

function mapDbToEmotion(dbVal) {
  if (!dbVal) return 'Planned';
  const val = dbVal.toLowerCase().replace(/_/g, ' ');
  return val.replace(/\b\w/g, (c) => c.toUpperCase());
}

// In-memory cache for strategy UUIDs per user
const strategyCache = new Map();

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

  // Resolve strategy name: from strategies(name) join, or direct column, or default 'Breakout'
  const strategyName = row.strategies?.name || row.strategy || 'Breakout';

  // Resolve session name: from sessions(name) join, or session_id lookup, or entry_time auto-detect, or direct column, or default 'London'
  const sessionName = row.sessions?.name
    || (row.session_id ? mapSessionIdToName(row.session_id) : null)
    || (row.entry_time ? getActiveSessionName(new Date(row.entry_time)) : null)
    || row.session
    || 'London';

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
    strategy: strategyName,
    session: sessionName,
    marketCondition: mapDbToMarketCondition(row.market_condition),
    emotion: mapDbToEmotion(row.emotion),
    mistakes: mistakesList,
    notes: row.notes || row.reason_for_entry || '',
    imageId: screenshotPath,
    ticket: row.id.substring(0, 8),
    accountId: row.account_id || null,
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
   * Resolve session name to session_id (1: Asian, 2: London, 3: New York, 4: London Close)
   */
  async getSessionId(sessionName) {
    if (!sessionName) return null;
    const staticId = mapSessionNameToId(sessionName);
    if (staticId) return staticId;

    if (supabase) {
      try {
        const clean = String(sessionName).replace(/\s*session\s*$/i, '').trim();
        const { data } = await supabase
          .from('sessions')
          .select('id, name')
          .ilike('name', `%${clean}%`)
          .limit(1);
        if (data && data.length > 0) {
          return data[0].id;
        }
      } catch (e) {
        console.warn('Failed to lookup session ID:', e);
      }
    }
    return null;
  },

  /**
   * Resolve or insert a strategy name for this user in public.strategies
   */
  async getOrCreateStrategyId(userId, strategyName) {
    if (!supabase || !userId || !strategyName) return null;
    const trimmed = String(strategyName).trim();
    if (!trimmed) return null;

    const cacheKey = `${userId}:${trimmed.toLowerCase()}`;
    if (strategyCache.has(cacheKey)) {
      return strategyCache.get(cacheKey);
    }

    try {
      // 1. Try to find existing strategy for this user
      const { data: existing } = await supabase
        .from('strategies')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', trimmed)
        .maybeSingle();

      if (existing?.id) {
        strategyCache.set(cacheKey, existing.id);
        return existing.id;
      }

      // 2. Insert new strategy if not found
      const { data: inserted, error: insertErr } = await supabase
        .from('strategies')
        .insert([{
          user_id: userId,
          name: trimmed,
          color_hex: '#C9A227',
          is_active: true,
        }])
        .select('id')
        .maybeSingle();

      if (inserted?.id) {
        strategyCache.set(cacheKey, inserted.id);
        return inserted.id;
      }

      // Concurrency retry if insert failed due to unique constraint
      if (insertErr) {
        const { data: retry } = await supabase
          .from('strategies')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', trimmed)
          .maybeSingle();
        if (retry?.id) {
          strategyCache.set(cacheKey, retry.id);
          return retry.id;
        }
      }
    } catch (e) {
      console.warn('Failed to resolve strategy ID:', e);
    }
    return null;
  },

  /**
   * Save a new trade to Supabase DB
   */
  async addTrade(tradeData, userId) {
    if (!supabase || !userId) return null;

    try {
      const strategyId = await this.getOrCreateStrategyId(userId, tradeData.strategy || 'Breakout');
      const sessionId = await this.getSessionId(tradeData.session || 'London');

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
        strategy_id: strategyId || null,
        session_id: sessionId || null,
        market_condition: mapMarketConditionToDb(tradeData.marketCondition),
        emotion: mapEmotionToDb(tradeData.emotion),
        reason_for_entry: tradeData.notes || '',
        notes: tradeData.notes || '',
        account_id: tradeData.accountId || null,
        pnl: typeof tradeData.pnl === 'number' ? tradeData.pnl : (parseFloat(tradeData.pnl) || 0),
        rr_ratio: typeof tradeData.rr === 'number' ? tradeData.rr : (parseFloat(tradeData.rr) || null),
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

      const mapped = mapRowToTrade(data);
      if (tradeData.strategy && (!mapped.strategy || mapped.strategy === 'Breakout')) {
        mapped.strategy = tradeData.strategy;
      }
      if (tradeData.session && (!mapped.session || mapped.session === 'London')) {
        mapped.session = tradeData.session;
      }
      return mapped;
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
    if (!supabase || !userId || !fileOrBlob) return null;
    try {
      // Validate file type
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
      if (fileOrBlob.type && !allowedMimeTypes.includes(fileOrBlob.type.toLowerCase())) {
        console.warn('Screenshot upload rejected: Invalid MIME type', fileOrBlob.type);
        throw new Error('Only PNG, JPEG, and WebP images are permitted.');
      }

      // Enforce 5MB max file size
      const maxSizeBytes = 5 * 1024 * 1024;
      if (fileOrBlob.size && fileOrBlob.size > maxSizeBytes) {
        console.warn('Screenshot upload rejected: File exceeds 5MB size limit', fileOrBlob.size);
        throw new Error('Screenshot file size must be less than 5 MB.');
      }

      const storagePath = `${userId}/${tradeId}/entry.png`;
      const { data, error } = await supabase.storage
        .from('trade-screenshots')
        .upload(storagePath, fileOrBlob, { upsert: true, contentType: fileOrBlob.type || 'image/png' });

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

      const filteredTrades = localTrades.filter((t) => {
        const entryTime = t.timestamp || new Date().toISOString();
        const key = `${entryTime}_${parseFloat(t.entryPrice) || 0}_${parseFloat(t.lotSize) || 0.1}`;
        return !existingKeys.has(key);
      });

      const rowsToInsert = await Promise.all(
        filteredTrades.map(async (t) => {
          const strategyId = await this.getOrCreateStrategyId(userId, t.strategy || 'Breakout');
          const sessionId = await this.getSessionId(t.session || 'London');
          return {
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
            strategy_id: strategyId || null,
            session_id: sessionId || null,
            market_condition: mapMarketConditionToDb(t.marketCondition),
            emotion: mapEmotionToDb(t.emotion),
            reason_for_entry: t.notes || '',
            notes: t.notes || '',
            account_id: t.accountId || null,
            pnl: typeof t.pnl === 'number' ? t.pnl : (parseFloat(t.pnl) || 0),
            rr_ratio: typeof t.rr === 'number' ? t.rr : (parseFloat(t.rr) || null),
          };
        })
      );

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
  },

  // ── Trading Sub-Accounts CRUD ─────────────────────────────────────
  async getAccounts(userId) {
    if (!supabase || !userId) return [];
    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase getAccounts error:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        broker: row.broker,
        accountType: row.account_type,
        accountNumber: row.account_number || '',
        initialBalance: parseFloat(row.initial_balance) || 10000,
        currency: row.currency || 'USD',
        leverage: row.leverage || '1:500',
        colorHex: row.color_hex || '#C9A227',
        isDefault: Boolean(row.is_default),
        isArchived: Boolean(row.is_archived),
        createdAt: row.created_at,
      }));
    } catch (e) {
      console.error('Failed to fetch trading accounts from Supabase:', e);
      return [];
    }
  },

  async addAccount(accountData, userId) {
    if (!supabase || !userId) return null;
    try {
      const row = {
        user_id: userId,
        name: accountData.name || 'Primary Exness MT5',
        broker: accountData.broker || 'Exness',
        account_type: accountData.accountType || 'live',
        account_number: accountData.accountNumber || '',
        initial_balance: parseFloat(accountData.initialBalance) || 10000,
        currency: accountData.currency || 'USD',
        leverage: accountData.leverage || '1:500',
        color_hex: accountData.colorHex || '#C9A227',
        is_default: Boolean(accountData.isDefault),
        is_archived: Boolean(accountData.isArchived),
      };

      const { data, error } = await supabase
        .from('trading_accounts')
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error('Supabase addAccount error:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        broker: data.broker,
        accountType: data.account_type,
        accountNumber: data.account_number || '',
        initialBalance: parseFloat(data.initial_balance) || 10000,
        currency: data.currency || 'USD',
        leverage: data.leverage || '1:500',
        colorHex: data.color_hex || '#C9A227',
        isDefault: Boolean(data.is_default),
        isArchived: Boolean(data.is_archived),
        createdAt: data.created_at,
      };
    } catch (e) {
      console.error('Failed to add account in Supabase:', e);
      return null;
    }
  },

  async updateAccount(id, updates) {
    if (!supabase || !id) return null;
    try {
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.broker !== undefined) dbUpdates.broker = updates.broker;
      if (updates.accountType !== undefined) dbUpdates.account_type = updates.accountType;
      if (updates.accountNumber !== undefined) dbUpdates.account_number = updates.accountNumber;
      if (updates.initialBalance !== undefined) dbUpdates.initial_balance = updates.initialBalance;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.leverage !== undefined) dbUpdates.leverage = updates.leverage;
      if (updates.colorHex !== undefined) dbUpdates.color_hex = updates.colorHex;
      if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('trading_accounts')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateAccount error:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        broker: data.broker,
        accountType: data.account_type,
        accountNumber: data.account_number || '',
        initialBalance: parseFloat(data.initial_balance) || 10000,
        currency: data.currency || 'USD',
        leverage: data.leverage || '1:500',
        colorHex: data.color_hex || '#C9A227',
        isDefault: Boolean(data.is_default),
        isArchived: Boolean(data.is_archived),
        createdAt: data.created_at,
      };
    } catch (e) {
      console.error('Failed to update account in Supabase:', e);
      return null;
    }
  },

  async archiveAccount(id) {
    return this.updateAccount(id, { isArchived: true });
  },

  async bulkImportTrades(tradesToImport = [], balanceOps = [], accountId = '', userId = '') {
    if (!supabase || !userId) return [];
    try {
      const rows = await Promise.all(
        tradesToImport.map(async (t) => {
          const strategyId = await this.getOrCreateStrategyId(userId, t.strategy || 'Breakout');
          const sessionId = await this.getSessionId(t.session || 'London');
          return {
            user_id: userId,
            account_id: accountId || null,
            symbol: t.symbol || 'XAUUSD',
            side: (t.side || 'Buy').toLowerCase(),
            status: 'closed',
            entry_price: parseFloat(t.entryPrice) || 0,
            exit_price: parseFloat(t.exitPrice) || 0,
            lot_size: parseFloat(t.lotSize) || 0.1,
            stop_loss: parseFloat(t.stopLoss) || null,
            take_profit: parseFloat(t.takeProfit) || null,
            entry_time: t.timestamp || new Date().toISOString(),
            exit_time: t.timestamp || new Date().toISOString(),
            strategy_id: strategyId || null,
            session_id: sessionId || null,
            market_condition: mapMarketConditionToDb(t.marketCondition),
            emotion: mapEmotionToDb(t.emotion),
            notes: t.notes || 'Imported from MT5',
            broker_position_id: t.brokerPositionId || null,
            broker_ticket_id: t.brokerTicketId || null,
            pnl: typeof t.pnl === 'number' ? t.pnl : (parseFloat(t.pnl) || 0),
            rr_ratio: typeof t.rr === 'number' ? t.rr : (parseFloat(t.rr) || null),
          };
        })
      );

      if (rows.length > 0) {
        const { error } = await supabase
          .from('trades')
          .insert(rows, { ignoreDuplicates: true });

        if (error) {
          console.error('Supabase bulkImportTrades error:', error);
        }
      }

      // Apply balance operations to sub-account
      if (accountId && balanceOps.length > 0) {
        const netAdjustment = balanceOps.reduce((sum, op) => sum + (parseFloat(op.amount) || 0), 0);
        if (netAdjustment !== 0) {
          const accounts = await this.getAccounts(userId);
          const targetAcc = accounts.find((a) => a.id === accountId);
          if (targetAcc) {
            const newBal = Math.max(0, targetAcc.initialBalance + netAdjustment);
            await this.updateAccount(accountId, { initialBalance: newBal });
          }
        }
      }

      return await this.getAllTrades();
    } catch (e) {
      console.error('Failed bulkImportTrades in Supabase:', e);
      return [];
    }
  },

  /**
   * Fetch historical price snapshots converted to OHLC candles for backtesting
   */
  async fetchHistoricalCandles(symbol = 'XAUUSD', timeframe = '4h', limit = 1000) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('price_snapshots')
        .select('captured_at, price, spread')
        .eq('symbol', symbol)
        .order('captured_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching price snapshots:', error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Convert snapshot ticks into synthetic OHLC bars based on timestamp
      return data.map((snap, i) => {
        const p = parseFloat(snap.price);
        const spread = parseFloat(snap.spread) || 0.25;
        return {
          time: snap.captured_at,
          open: p - (i % 2 === 0 ? spread * 0.5 : -spread * 0.5),
          high: p + spread * 1.5,
          low: p - spread * 1.5,
          close: p,
        };
      });
    } catch (e) {
      console.error('Failed to fetch historical candles:', e);
      return [];
    }
  },

  // ── Target Plans Database Operations ─────────────────────────────
  async getTargetPlans(userId) {
    if (!supabase || !userId) return [];
    try {
      const { data, error } = await supabase
        .from('target_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase getTargetPlans error:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        accountId: row.account_id || 'all',
        startingBalance: parseFloat(row.starting_balance) || 50,
        targetBalance: parseFloat(row.target_balance) || 100,
        riskPerTradePct: parseFloat(row.risk_per_trade_pct) || 2.0,
        targetRR: parseFloat(row.target_rr) || 2.0,
        maxDailyLossPct: parseFloat(row.max_daily_loss_pct) || 4.0,
        drawdownFloor: parseFloat(row.drawdown_floor) || 40,
        maxOpenTrades: parseInt(row.max_open_trades, 10) || 1,
        milestoneStages: parseInt(row.milestone_stages, 10) || 4,
        rules: Array.isArray(row.rules) ? row.rules : [],
        status: row.status || 'active',
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (e) {
      console.error('Failed to fetch target plans from Supabase:', e);
      return [];
    }
  },

  async addTargetPlan(planData, userId) {
    if (!supabase || !userId) return null;
    try {
      const row = {
        user_id: userId,
        account_id: planData.accountId && planData.accountId !== 'all' ? planData.accountId : null,
        name: planData.name || 'Account Growth Plan ($50 ➔ $100)',
        starting_balance: parseFloat(planData.startingBalance) || 50,
        target_balance: parseFloat(planData.targetBalance) || 100,
        risk_per_trade_pct: parseFloat(planData.riskPerTradePct) || 2.0,
        target_rr: parseFloat(planData.targetRR) || 2.0,
        max_daily_loss_pct: parseFloat(planData.maxDailyLossPct) || 4.0,
        drawdown_floor: parseFloat(planData.drawdownFloor) || 40,
        max_open_trades: parseInt(planData.maxOpenTrades, 10) || 1,
        milestone_stages: parseInt(planData.milestoneStages, 10) || 4,
        rules: planData.rules || [],
        status: planData.status || 'active',
        is_active: planData.isActive !== false,
      };

      const { data, error } = await supabase
        .from('target_plans')
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error('Supabase addTargetPlan error:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        accountId: data.account_id || 'all',
        startingBalance: parseFloat(data.starting_balance) || 50,
        targetBalance: parseFloat(data.target_balance) || 100,
        riskPerTradePct: parseFloat(data.risk_per_trade_pct) || 2.0,
        targetRR: parseFloat(data.target_rr) || 2.0,
        maxDailyLossPct: parseFloat(data.max_daily_loss_pct) || 4.0,
        drawdownFloor: parseFloat(data.drawdown_floor) || 40,
        maxOpenTrades: parseInt(data.max_open_trades, 10) || 1,
        milestoneStages: parseInt(data.milestone_stages, 10) || 4,
        rules: Array.isArray(data.rules) ? data.rules : [],
        status: data.status || 'active',
        isActive: Boolean(data.is_active),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (e) {
      console.error('Failed to add target plan to Supabase:', e);
      return null;
    }
  },

  async updateTargetPlan(id, updates) {
    if (!supabase || !id) return null;
    try {
      const row = {};
      if (updates.name !== undefined) row.name = updates.name;
      if (updates.accountId !== undefined) row.account_id = updates.accountId !== 'all' ? updates.accountId : null;
      if (updates.startingBalance !== undefined) row.starting_balance = parseFloat(updates.startingBalance);
      if (updates.targetBalance !== undefined) row.target_balance = parseFloat(updates.targetBalance);
      if (updates.riskPerTradePct !== undefined) row.risk_per_trade_pct = parseFloat(updates.riskPerTradePct);
      if (updates.targetRR !== undefined) row.target_rr = parseFloat(updates.targetRR);
      if (updates.maxDailyLossPct !== undefined) row.max_daily_loss_pct = parseFloat(updates.maxDailyLossPct);
      if (updates.drawdownFloor !== undefined) row.drawdown_floor = parseFloat(updates.drawdownFloor);
      if (updates.maxOpenTrades !== undefined) row.max_open_trades = parseInt(updates.maxOpenTrades, 10);
      if (updates.milestoneStages !== undefined) row.milestone_stages = parseInt(updates.milestoneStages, 10);
      if (updates.rules !== undefined) row.rules = updates.rules;
      if (updates.status !== undefined) row.status = updates.status;
      if (updates.isActive !== undefined) row.is_active = updates.isActive;
      row.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('target_plans')
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateTargetPlan error:', error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        accountId: data.account_id || 'all',
        startingBalance: parseFloat(data.starting_balance) || 50,
        targetBalance: parseFloat(data.target_balance) || 100,
        riskPerTradePct: parseFloat(data.risk_per_trade_pct) || 2.0,
        targetRR: parseFloat(data.target_rr) || 2.0,
        maxDailyLossPct: parseFloat(data.max_daily_loss_pct) || 4.0,
        drawdownFloor: parseFloat(data.drawdown_floor) || 40,
        maxOpenTrades: parseInt(data.max_open_trades, 10) || 1,
        milestoneStages: parseInt(data.milestone_stages, 10) || 4,
        rules: Array.isArray(data.rules) ? data.rules : [],
        status: data.status || 'active',
        isActive: Boolean(data.is_active),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (e) {
      console.error('Failed to update target plan in Supabase:', e);
      return null;
    }
  },

  async deleteTargetPlan(id) {
    if (!supabase || !id) return false;
    try {
      const { error } = await supabase
        .from('target_plans')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase deleteTargetPlan error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Failed to delete target plan from Supabase:', e);
      return false;
    }
  }
};
